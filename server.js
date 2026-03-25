const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const https = require("https");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const root = __dirname;
const dataDir = path.join(root, "data");
const uploadDir = path.join(root, "uploads");
const dbPath = path.join(dataDir, "db.json");
const port = Number(process.env.PORT || 8080);
const captchaSecret = process.env.CAPTCHA_SECRET || "denizstagram-captcha-secret";
const resendApiKey = process.env.RESEND_API_KEY || "";
const emailFrom = process.env.EMAIL_FROM || "";

const initialDb = {
  users: [],
  stories: [],
  posts: [],
  reels: [],
  taggedPosts: [],
  notifications: [],
  conversations: [],
  sessions: {},
  pendingEmailVerifications: []
};

function makeId(prefix) {
  return `${prefix}-${crypto.randomUUID().replace(/-/g, "")}`;
}

function hashPassword(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function makeCaptchaCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function signCaptcha(token, code) {
  return crypto.createHmac("sha256", captchaSecret).update(`${token}:${`${code}`.trim().toUpperCase()}`).digest("hex");
}

function sameToken(left, right) {
  const a = Buffer.from(`${left || ""}`);
  const b = Buffer.from(`${right || ""}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function buildCaptchaImage(code) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="180" height="64" viewBox="0 0 180 64">
      <rect width="180" height="64" rx="14" fill="#f7f2ea"/>
      <path d="M8 45 C35 8, 70 60, 100 18 S150 5, 172 38" stroke="#ff8a3d" stroke-width="5" fill="none" opacity="0.45"/>
      <path d="M10 14 C45 52, 72 2, 108 36 S154 63, 170 16" stroke="#1d3b53" stroke-width="4" fill="none" opacity="0.35"/>
      <text x="90" y="42" text-anchor="middle" font-family="Verdana" font-size="28" font-weight="700" letter-spacing="6" fill="#222">${code}</text>
    </svg>
  `;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function captchaExpired(token) {
  const issuedAt = Number(`${token || ""}`.split(".")[0]);
  return !issuedAt || Date.now() - issuedAt > 10 * 60 * 1000;
}

function validateHumanCheck(body) {
  if (!body || body.notRobot !== true) return "human_check_required";
  if (`${body.website || ""}`.trim()) return "bot_detected";
  if (Number(body.humanDelayMs || 0) < 1500) return "human_check_too_fast";
  if (!body.captchaToken || !body.captchaSignature || !body.captchaInput) return "captcha_required";
  if (captchaExpired(body.captchaToken)) return "captcha_expired";
  if (!sameToken(body.captchaSignature, signCaptcha(body.captchaToken, body.captchaInput))) return "captcha_invalid";
  return null;
}

function createCaptchaPayload() {
  const token = `${Date.now()}.${makeId("captcha")}`;
  const code = makeCaptchaCode();
  return {
    token,
    image: buildCaptchaImage(code),
    signature: signCaptcha(token, code)
  };
}

function makeEmailCode() {
  return `${Math.floor(100000 + Math.random() * 900000)}`;
}

async function sendVerificationEmail(email, code) {
  if (!resendApiKey || !emailFrom) throw new Error("email_service_unavailable");
  const payload = JSON.stringify({
    from: emailFrom,
    to: [email],
    subject: "Denizstagram dogrulama kodu",
    html: `<p>Kayit kodun: <strong>${code}</strong></p><p>Bu kod 10 dakika gecerli.</p>`
  });
  await new Promise((resolve, reject) => {
    const req = https.request(
      "https://api.resend.com/emails",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload)
        }
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
          else reject(new Error("email_service_unavailable"));
        });
      }
    );
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

async function ensureStorage() {
  await fsp.mkdir(dataDir, { recursive: true });
  await fsp.mkdir(uploadDir, { recursive: true });
  try {
    await fsp.access(dbPath);
  } catch {
    await fsp.writeFile(dbPath, JSON.stringify(initialDb, null, 2), "utf8");
  }
}

async function readDb() {
  const text = await fsp.readFile(dbPath, "utf8");
  return JSON.parse(text);
}

async function saveDb(db) {
  await fsp.writeFile(dbPath, JSON.stringify(db, null, 2), "utf8");
}

function publicUser(user) {
  return {
    username: user.username,
    displayName: user.displayName,
    bio: user.bio,
    avatar: user.avatar,
    lastLocation: user.lastLocation || "",
    privateAccount: Boolean(user.privateAccount),
    followers: user.followers || [],
    following: user.following || [],
    followRequests: user.followRequests || []
  };
}

function findUser(db, username) {
  return db.users.find((user) => user.username === username) || null;
}

function canSeeUser(viewer, owner) {
  if (!viewer || !owner) return false;
  if (viewer.username === owner.username) return true;
  if (!owner.privateAccount) return true;
  return (owner.followers || []).includes(viewer.username);
}

function addNotification(db, to, actor, text, type = "info") {
  db.notifications.unshift({
    id: makeId("notif"),
    to,
    actor,
    text,
    type,
    time: "Simdi"
  });
  db.notifications = db.notifications.slice(0, 50);
}

function ensureConversation(db, one, two) {
  let conversation = db.conversations.find((item) => {
    const participants = item.participants || [];
    return participants.length === 2 && participants.includes(one) && participants.includes(two);
  });
  if (!conversation) {
    conversation = {
      id: makeId("conv"),
      participants: [one, two],
      messages: []
    };
    db.conversations.push(conversation);
  }
  return conversation;
}

function buildBootstrap(db, viewer) {
  const stories = db.stories.filter((story) => canSeeUser(viewer, findUser(db, story.owner)));
  const posts = db.posts.filter((post) => canSeeUser(viewer, findUser(db, post.author)));
  const reels = db.reels.filter((reel) => canSeeUser(viewer, findUser(db, reel.author)));
  const notifications = db.notifications.filter((item) => item.to === viewer.username);
  const conversations = db.conversations.filter((item) => (item.participants || []).includes(viewer.username));

  return {
    me: publicUser(viewer),
    users: db.users.map(publicUser),
    stories,
    posts,
    reels,
    taggedPosts: db.taggedPosts || [],
    notifications,
    conversations
  };
}

function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return Object.fromEntries(
    raw
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [key, ...rest] = part.split("=");
        return [key, rest.join("=")];
      })
  );
}

function getViewer(req, db) {
  const token = parseCookies(req).ds_session;
  if (!token) return null;
  const username = db.sessions[token];
  return username ? findUser(db, username) : null;
}

function sendJson(res, code, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    ...extraHeaders
  });
  res.end(body);
}

function sendFile(res, filePath) {
  if (!fs.existsSync(filePath)) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".mp4": "video/mp4"
    }[ext] || "application/octet-stream";
  const stream = fs.createReadStream(filePath);
  res.writeHead(200, { "Content-Type": contentType });
  stream.pipe(res);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 25 * 1024 * 1024) {
        reject(new Error("body_too_large"));
      }
    });
    req.on("end", () => {
      if (!data) resolve({});
      else {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("invalid_json"));
        }
      }
    });
    req.on("error", reject);
  });
}

async function saveUpload(body) {
  if (body.dataUrl && /^data:([^;]+);base64,(.+)$/.test(body.dataUrl)) {
    const [, mime, base64] = body.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    const extension =
      {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/webp": ".webp",
        "image/gif": ".gif",
        "video/mp4": ".mp4"
      }[mime] || ".bin";
    const name = `${makeId("upload")}${extension}`;
    const filePath = path.join(uploadDir, name);
    await fsp.writeFile(filePath, Buffer.from(base64, "base64"));
    return `/uploads/${name}`;
  }
  return `${body.url || ""}`.trim();
}

async function handleApi(req, res, pathname) {
  const db = await readDb();

  if (pathname === "/api/auth/captcha" && req.method === "GET") {
    return sendJson(res, 200, createCaptchaPayload());
  }

  if (pathname === "/api/auth/send-email-code" && req.method === "POST") {
    const body = await readBody(req);
    const email = `${body.email || ""}`.trim().toLowerCase();
    if (!email) return sendJson(res, 400, { error: "email_required" });
    const humanCheckError = validateHumanCheck(body);
    if (humanCheckError) return sendJson(res, 400, { error: humanCheckError });
    const code = makeEmailCode();
    const verificationToken = makeId("emailverify");
    await sendVerificationEmail(email, code);
    db.pendingEmailVerifications = (db.pendingEmailVerifications || []).filter(
      (item) => item.email !== email && item.token !== verificationToken
    );
    db.pendingEmailVerifications.push({
      token: verificationToken,
      email,
      codeHash: hashPassword(code),
      expiresAt: Date.now() + 10 * 60 * 1000
    });
    await saveDb(db);
    return sendJson(res, 200, { ok: true, verificationToken });
  }

  if (pathname === "/api/register" && req.method === "POST") {
    const body = await readBody(req);
    const username = `${body.username || ""}`.trim().toLowerCase();
    const email = `${body.email || ""}`.trim().toLowerCase();
    if (!username || !body.password) return sendJson(res, 400, { error: "invalid_input" });
    if (!email) return sendJson(res, 400, { error: "email_required" });
    const humanCheckError = validateHumanCheck(body);
    if (humanCheckError) return sendJson(res, 400, { error: humanCheckError });
    const verification = (db.pendingEmailVerifications || []).find(
      (item) => item.token === body.emailVerificationToken && item.email === email
    );
    if (!verification || !body.emailCode) return sendJson(res, 400, { error: "email_verification_required" });
    if (verification.expiresAt < Date.now()) return sendJson(res, 400, { error: "email_verification_required" });
    if (verification.codeHash !== hashPassword(body.emailCode || "")) {
      return sendJson(res, 400, { error: "email_verification_invalid" });
    }
    if (findUser(db, username)) return sendJson(res, 409, { error: "username_taken" });
    db.users.push({
      username,
      email,
      emailVerified: true,
      displayName: body.displayName || username,
      passwordHash: hashPassword(body.password),
      bio: "",
      avatar: "",
      privateAccount: false,
      followers: [],
      following: [],
      followRequests: []
    });
    db.pendingEmailVerifications = (db.pendingEmailVerifications || []).filter((item) => item.token !== verification.token);
    await saveDb(db);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === "/api/login" && req.method === "POST") {
    const body = await readBody(req);
    const username = `${body.username || ""}`.trim().toLowerCase();
    const humanCheckError = validateHumanCheck(body);
    if (humanCheckError) return sendJson(res, 400, { error: humanCheckError });
    const viewer = findUser(db, username);
    if (!viewer || viewer.passwordHash !== hashPassword(body.password || "")) {
      return sendJson(res, 401, { error: "invalid_credentials" });
    }
    const token = makeId("sess");
    db.sessions[token] = viewer.username;
    await saveDb(db);
    return sendJson(res, 200, { ok: true }, { "Set-Cookie": `ds_session=${token}; Path=/; HttpOnly; SameSite=Lax` });
  }

  if (pathname === "/api/logout" && req.method === "POST") {
    const token = parseCookies(req).ds_session;
    if (token) delete db.sessions[token];
    await saveDb(db);
    return sendJson(res, 200, { ok: true }, { "Set-Cookie": "ds_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax" });
  }

  const viewer = getViewer(req, db);
  if (!viewer) return sendJson(res, 401, { error: "auth_required" });

  if (pathname === "/api/bootstrap" && req.method === "GET") {
    return sendJson(res, 200, buildBootstrap(db, viewer));
  }

  if (pathname === "/api/create" && req.method === "POST") {
    const body = await readBody(req);
    const media = await saveUpload(body);
    if (!media) return sendJson(res, 400, { error: "media_required" });
    if (body.type === "reel") {
      db.reels.push({
        id: makeId("reel"),
        author: viewer.username,
        caption: body.caption || body.title || "",
        media,
        likedBy: [],
        views: 0,
        comments: [],
        music: body.music || "",
        location: body.location || "",
        coverText: body.coverText || "",
        settings: body.reelSettings || {},
        shares: 0,
        watchTime: 0,
        completionRate: 0
      });
      viewer.lastLocation = body.location || viewer.lastLocation || "";
    } else if (body.type === "story") {
      db.stories = db.stories.filter((story) => !(story.owner === viewer.username && story.placeholder));
      db.stories.unshift({
        id: makeId("story"),
        owner: viewer.username,
        image: media,
        caption: body.caption || body.title || ""
      });
    } else {
      db.posts.push({
        id: makeId("post"),
        author: viewer.username,
        title: body.title || "",
        caption: body.caption || "",
        media,
        likedBy: [],
        savedBy: [],
        dateLabel: "Simdi",
        comments: []
      });
    }
    await saveDb(db);
    return sendJson(res, 200, buildBootstrap(db, viewer));
  }

  if (pathname === "/api/follow" && req.method === "POST") {
    const body = await readBody(req);
    const target = findUser(db, body.username);
    if (!target || target.username === viewer.username) return sendJson(res, 404, { error: "not_found" });
    if ((target.followers || []).includes(viewer.username)) {
      target.followers = target.followers.filter((name) => name !== viewer.username);
      viewer.following = (viewer.following || []).filter((name) => name !== target.username);
    } else if ((target.followRequests || []).includes(viewer.username)) {
    } else if (target.privateAccount) {
      target.followRequests.push(viewer.username);
      addNotification(db, target.username, viewer.username, "sana takip istegi gonderdi.", "follow_request");
    } else {
      target.followers.push(viewer.username);
      viewer.following.push(target.username);
      addNotification(db, target.username, viewer.username, "seni takip etmeye basladi.");
    }
    await saveDb(db);
    return sendJson(res, 200, buildBootstrap(db, viewer));
  }

  if (pathname === "/api/follow/accept" && req.method === "POST") {
    const body = await readBody(req);
    const requester = findUser(db, body.username);
    if (!requester) return sendJson(res, 404, { error: "not_found" });
    viewer.followRequests = (viewer.followRequests || []).filter((name) => name !== requester.username);
    if (!viewer.followers.includes(requester.username)) viewer.followers.push(requester.username);
    if (!requester.following.includes(viewer.username)) requester.following.push(viewer.username);
    db.notifications = db.notifications.filter(
      (item) => !(item.to === viewer.username && item.type === "follow_request" && item.actor === requester.username)
    );
    addNotification(db, requester.username, viewer.username, "takip istegini kabul etti.");
    await saveDb(db);
    return sendJson(res, 200, buildBootstrap(db, viewer));
  }

  if (pathname === "/api/post/like" && req.method === "POST") {
    const body = await readBody(req);
    const post = db.posts.find((item) => item.id === body.id);
    if (!post) return sendJson(res, 404, { error: "not_found" });
    if (post.likedBy.includes(viewer.username)) {
      post.likedBy = post.likedBy.filter((name) => name !== viewer.username);
    } else {
      post.likedBy.push(viewer.username);
      if (post.author !== viewer.username) addNotification(db, post.author, viewer.username, "gonderini begendi.");
    }
    await saveDb(db);
    return sendJson(res, 200, buildBootstrap(db, viewer));
  }

  if (pathname === "/api/post/save" && req.method === "POST") {
    const body = await readBody(req);
    const post = db.posts.find((item) => item.id === body.id);
    if (!post) return sendJson(res, 404, { error: "not_found" });
    if (post.savedBy.includes(viewer.username)) {
      post.savedBy = post.savedBy.filter((name) => name !== viewer.username);
    } else {
      post.savedBy.push(viewer.username);
    }
    await saveDb(db);
    return sendJson(res, 200, buildBootstrap(db, viewer));
  }

  if (pathname === "/api/post/comment" && req.method === "POST") {
    const body = await readBody(req);
    const post = db.posts.find((item) => item.id === body.id);
    if (!post) return sendJson(res, 404, { error: "not_found" });
    post.comments.push({ id: makeId("comment"), author: viewer.username, text: body.text || "" });
    if (post.author !== viewer.username) addNotification(db, post.author, viewer.username, "gonderine yorum yapti.");
    await saveDb(db);
    return sendJson(res, 200, buildBootstrap(db, viewer));
  }

  if (pathname === "/api/post/delete" && req.method === "POST") {
    const body = await readBody(req);
    const post = db.posts.find((item) => item.id === body.id);
    if (!post) return sendJson(res, 404, { error: "not_found" });
    if (post.author !== viewer.username) return sendJson(res, 403, { error: "forbidden" });
    db.posts = db.posts.filter((item) => item.id !== body.id);
    await saveDb(db);
    return sendJson(res, 200, buildBootstrap(db, viewer));
  }

  if (pathname === "/api/reel/like" && req.method === "POST") {
    const body = await readBody(req);
    const reel = db.reels.find((item) => item.id === body.id);
    if (!reel) return sendJson(res, 404, { error: "not_found" });
    if (reel.likedBy.includes(viewer.username)) {
      reel.likedBy = reel.likedBy.filter((name) => name !== viewer.username);
    } else {
      reel.likedBy.push(viewer.username);
      if (reel.author !== viewer.username) addNotification(db, reel.author, viewer.username, "reelini begendi.");
    }
    await saveDb(db);
    return sendJson(res, 200, buildBootstrap(db, viewer));
  }

  if (pathname === "/api/reel/comment" && req.method === "POST") {
    const body = await readBody(req);
    const reel = db.reels.find((item) => item.id === body.id);
    if (!reel) return sendJson(res, 404, { error: "not_found" });
    reel.comments ||= [];
    reel.comments.push({ id: makeId("comment"), author: viewer.username, text: body.text || "" });
    if (reel.author !== viewer.username) addNotification(db, reel.author, viewer.username, "reeline yorum yapti.");
    await saveDb(db);
    return sendJson(res, 200, buildBootstrap(db, viewer));
  }

  if (pathname === "/api/reel/view" && req.method === "POST") {
    const body = await readBody(req);
    const reel = db.reels.find((item) => item.id === body.id);
    if (!reel) return sendJson(res, 404, { error: "not_found" });
    reel.views = Number(reel.views || 0) + 1;
    reel.watchTime = Number(reel.watchTime || 0) + Number(body.watchTime || 3);
    const completion = Math.max(0, Math.min(100, Number(body.completionRate || 0)));
    reel.completionRate = Math.round(((Number(reel.completionRate || 0) + completion) / 2) || completion);
    await saveDb(db);
    return sendJson(res, 200, buildBootstrap(db, viewer));
  }

  if (pathname === "/api/messages" && req.method === "POST") {
    const body = await readBody(req);
    const target = findUser(db, body.username);
    if (!target || target.username === viewer.username) return sendJson(res, 404, { error: "not_found" });
    const conversation = ensureConversation(db, viewer.username, target.username);
    if (body.text) {
      conversation.messages.push({
        id: makeId("message"),
        sender: viewer.username,
        text: body.text,
        time: "Simdi"
      });
      addNotification(db, target.username, viewer.username, "sana mesaj gonderdi.");
      if (body.reelId) {
        const reel = db.reels.find((item) => item.id === body.reelId);
        if (reel) reel.shares = Number(reel.shares || 0) + 1;
      }
    }
    await saveDb(db);
    return sendJson(res, 200, buildBootstrap(db, viewer));
  }

  if (pathname === "/api/profile" && req.method === "POST") {
    const body = await readBody(req);
    const uploadedAvatar = await saveUpload(body);
    viewer.displayName = body.displayName || viewer.displayName;
    viewer.bio = body.bio || "";
    viewer.avatar = uploadedAvatar || body.avatar || "";
    viewer.lastLocation = body.lastLocation || viewer.lastLocation || "";
    viewer.privateAccount = Boolean(body.privateAccount);
    await saveDb(db);
    return sendJson(res, 200, buildBootstrap(db, viewer));
  }

  return sendJson(res, 404, { error: "not_found" });
}

async function handleRequest(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  try {
    if (pathname === "/") return sendFile(res, path.join(root, "index.html"));
    if (pathname === "/app.js") return sendFile(res, path.join(root, "app.js"));
    if (pathname === "/styles.css") return sendFile(res, path.join(root, "styles.css"));
    if (pathname.startsWith("/uploads/")) return sendFile(res, path.join(root, pathname));
    if (pathname.startsWith("/api/")) return await handleApi(req, res, pathname);
    return sendJson(res, 404, { error: "not_found" });
  } catch (error) {
    return sendJson(res, 500, { error: "server_error", detail: error.message });
  }
}

ensureStorage().then(() => {
  http.createServer(handleRequest).listen(port, "0.0.0.0", () => {
    console.log(`Denizstagram Node server running on port ${port}`);
  });
});
