const state = {
  authMode: "login",
  composeType: "post",
  profileTab: "posts",
  data: null,
  viewedReels: new Set(),
  exploreQuery: "",
  interestTerms: [],
  authChallenge: null,
  authChallengeStartedAt: Date.now(),
  pendingEmailVerification: null
};

const $ = (id) => document.getElementById(id);
const els = {
  authScreen: $("authScreen"),
  appScreen: $("appScreen"),
  authForm: $("authForm"),
  usernameInput: $("usernameInput"),
  displayNameInput: $("displayNameInput"),
  emailInput: $("emailInput"),
  emailCodeInput: $("emailCodeInput"),
  sendEmailCodeButton: $("sendEmailCodeButton"),
  emailVerificationHint: $("emailVerificationHint"),
  passwordInput: $("passwordInput"),
  authChallengeLabel: $("authChallengeLabel"),
  authChallengeInput: $("authChallengeInput"),
  authCaptchaImage: $("authCaptchaImage"),
  refreshCaptchaButton: $("refreshCaptchaButton"),
  authRobotCheckbox: $("authRobotCheckbox"),
  authWebsiteInput: $("authWebsiteInput"),
  authSubmitButton: $("authSubmitButton"),
  authHint: $("authHint"),
  nameField: $("nameField"),
  emailField: $("emailField"),
  emailVerificationBlock: $("emailVerificationBlock"),
  screenTitle: $("screenTitle"),
  storiesRow: $("storiesRow"),
  composerHandle: $("composerHandle"),
  composerAvatar: $("composerAvatar"),
  feedList: $("feedList"),
  reelsList: $("reelsList"),
  exploreGrid: $("exploreGrid"),
  exploreReelsGrid: $("exploreReelsGrid"),
  exploreSearchInput: $("exploreSearchInput"),
  friendMap: $("friendMap"),
  notificationList: $("notificationList"),
  composeForm: $("composeForm"),
  composeTitle: $("composeTitle"),
  composeCaption: $("composeCaption"),
  composeMedia: $("composeMedia"),
  composeFile: $("composeFile"),
  editorPreviewFrame: $("editorPreviewFrame"),
  editorPreviewImage: $("editorPreviewImage"),
  editorPreviewVideo: $("editorPreviewVideo"),
  editorPreviewTitle: $("editorPreviewTitle"),
  editorPreviewMeta: $("editorPreviewMeta"),
  reelEditorPanel: $("reelEditorPanel"),
  reelMusic: $("reelMusic"),
  reelLocation: $("reelLocation"),
  reelCoverText: $("reelCoverText"),
  reelFilter: $("reelFilter"),
  reelBrightness: $("reelBrightness"),
  reelContrast: $("reelContrast"),
  reelSaturation: $("reelSaturation"),
  reelTrimStart: $("reelTrimStart"),
  reelTrimEnd: $("reelTrimEnd"),
  reelVoiceMode: $("reelVoiceMode"),
  reelSpeed: $("reelSpeed"),
  profileName: $("profileName"),
  profileInitial: $("profileInitial"),
  profileBio: $("profileBio"),
  postCount: $("postCount"),
  followerCount: $("followerCount"),
  followingCount: $("followingCount"),
  profileTabContent: $("profileTabContent"),
  logoutButton: $("logoutButton"),
  openMessagesButton: $("openMessagesButton"),
  openNotificationsButton: $("openNotificationsButton"),
  messageList: $("messageList"),
  chatAvatar: $("chatAvatar"),
  chatTitle: $("chatTitle"),
  chatSubtitle: $("chatSubtitle"),
  chatThread: $("chatThread"),
  messageForm: $("messageForm"),
  messageInput: $("messageInput"),
  settingsForm: $("settingsForm"),
  settingsDisplayName: $("settingsDisplayName"),
  settingsBio: $("settingsBio"),
  settingsAvatar: $("settingsAvatar"),
  settingsAvatarFile: $("settingsAvatarFile"),
  settingsPrivate: $("settingsPrivate"),
  storyModal: $("storyModal"),
  storyModalImage: $("storyModalImage"),
  storyModalTitle: $("storyModalTitle"),
  storyModalCaption: $("storyModalCaption"),
  closeStoryButton: $("closeStoryButton"),
  feedCardTemplate: $("feedCardTemplate"),
  reelCardTemplate: $("reelCardTemplate")
};

function me() {
  return state.data?.me || null;
}

function users() {
  return state.data?.users || [];
}

function user(username) {
  return users().find((item) => item.username === username) || null;
}

function avatarMarkup(accountOrName) {
  const account = typeof accountOrName === "object" ? accountOrName : user(accountOrName);
  const username = account?.username || `${accountOrName || "?"}`;
  return account?.avatar
    ? `<img src="${account.avatar}" alt="${username}" class="avatar-image" />`
    : `<span>${username[0]?.toUpperCase() || "?"}</span>`;
}

function empty(message) {
  return `<div class="empty-state">${message}</div>`;
}

function authErrorMessage(code) {
  return (
    {
      invalid_input: "Kullanici adi, sifre ve dogrulama zorunlu.",
      invalid_credentials: "Kullanici adi veya sifre hatali.",
      username_taken: "Bu kullanici adi zaten kullaniliyor.",
      email_required: "Kayit icin e-posta zorunlu.",
      email_verification_required: "Kayit olmadan once mail kodunu dogrula.",
      email_verification_invalid: "Mail dogrulama kodu hatali.",
      email_service_unavailable: "Mail gonderim servisi ayarlanmadigi icin kod gonderilemedi.",
      captcha_required: "Captcha zorunlu.",
      captcha_invalid: "Captcha kodu hatali.",
      captcha_expired: "Captcha suresi doldu. Yenile.",
      human_check_required: "Robot olmadigini onaylaman gerekiyor.",
      human_check_too_fast: "Form cok hizli gonderildi. Tekrar dene.",
      bot_detected: "Bot benzeri istek algilandi."
    }[code] || code
  );
}

async function resetAuthChallenge() {
  state.authChallengeStartedAt = Date.now();
  if (els.authChallengeLabel) els.authChallengeLabel.textContent = "Captcha yukleniyor...";
  if (els.authChallengeInput) els.authChallengeInput.value = "";
  if (els.authRobotCheckbox) els.authRobotCheckbox.checked = false;
  if (els.authWebsiteInput) els.authWebsiteInput.value = "";
  try {
    const captcha = await api("/api/auth/captcha", { method: "GET", headers: {} });
    state.authChallenge = captcha;
    if (els.authCaptchaImage) els.authCaptchaImage.src = captcha.image;
    if (els.authChallengeLabel) els.authChallengeLabel.textContent = "Captcha kodu";
  } catch {
    state.authChallenge = null;
    if (els.authChallengeLabel) els.authChallengeLabel.textContent = "Captcha yuklenemedi";
  }
}

function loadInterestTerms() {
  try {
    return JSON.parse(localStorage.getItem("denizstagram_interest_terms") || "[]");
  } catch {
    return [];
  }
}

function saveInterestTerm(term) {
  const normalized = `${term || ""}`.trim().toLowerCase();
  if (!normalized) return;
  const next = [normalized, ...state.interestTerms.filter((item) => item !== normalized)].slice(0, 12);
  state.interestTerms = next;
  localStorage.setItem("denizstagram_interest_terms", JSON.stringify(next));
}

function buildInterestProfile() {
  const account = me();
  const ownPosts = (state.data?.posts || []).filter((post) => post.author === account?.username);
  const ownReels = (state.data?.reels || []).filter((reel) => reel.author === account?.username);
  const terms = [
    ...(state.interestTerms || []),
    ...(account?.following || []),
    account?.bio || "",
    ...ownPosts.flatMap((post) => [post.title, post.caption]),
    ...ownReels.flatMap((reel) => [reel.caption, reel.music, reel.location, reel.coverText])
  ]
    .join(" ")
    .toLowerCase()
    .match(/[a-z0-9#@_-]{3,}/gi);
  return new Set(terms || []);
}

function linkifyText(text = "") {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>');
}

function isVideoMedia(src = "") {
  return /(\.mp4|\.webm|\.ogg|data:video\/)/i.test(src);
}

function buildFilterStyle(settings = {}) {
  const preset =
    {
      none: "",
      warm: "sepia(0.18) hue-rotate(-8deg)",
      mono: "grayscale(1)",
      cinema: "contrast(1.08) saturate(1.12) hue-rotate(4deg)"
    }[settings.filter || "none"] || "";
  return [
    `brightness(${Number(settings.brightness || 100)}%)`,
    `contrast(${Number(settings.contrast || 100)}%)`,
    `saturate(${Number(settings.saturation || 100)}%)`,
    preset
  ].join(" ");
}

function voiceModeStyle(mode = "original") {
  return {
    original: { rate: 1, label: "Orijinal ses" },
    cinematic: { rate: 0.92, label: "Cinematic ses" },
    deep: { rate: 0.82, label: "Deep voice" },
    helium: { rate: 1.18, label: "Helium voice" }
  }[mode] || { rate: 1, label: "Orijinal ses" };
}

function createMediaMarkup(src, alt, className, settings = {}) {
  const style = buildFilterStyle(settings);
  if (isVideoMedia(src)) {
    return `<video class="${className}" src="${src}" playsinline muted loop autoplay preload="metadata" style="filter:${style}"></video>`;
  }
  return `<img class="${className}" src="${src}" alt="${alt}" style="filter:${style}" />`;
}

function syncEditorPreview() {
  if (!els.editorPreviewFrame) return;
  const file = els.composeFile.files[0];
  const mediaUrl = els.composeMedia.value.trim();
  const settings = {
    filter: els.reelFilter.value,
    brightness: els.reelBrightness.value,
    contrast: els.reelContrast.value,
    saturation: els.reelSaturation.value
  };
  els.reelEditorPanel.classList.toggle("active", state.composeType === "reel");
  els.editorPreviewTitle.textContent = els.composeTitle.value.trim() || "Onizleme";
  els.editorPreviewMeta.textContent =
    state.composeType === "reel"
      ? `${els.reelMusic.value.trim() || "Ses secilmedi"} - ${els.reelLocation.value.trim() || "Konum yok"} - ${voiceModeStyle(els.reelVoiceMode.value).label}`
      : state.composeType === "story"
        ? "Hikaye onizlemesi"
        : "Gonderi onizlemesi";

  const applySource = (src) => {
    const style = buildFilterStyle(settings);
    const video = isVideoMedia(src || "");
    els.editorPreviewImage.classList.toggle("hidden", video);
    els.editorPreviewVideo.classList.toggle("hidden", !video);
    if (video) {
      els.editorPreviewVideo.src = src || "";
      els.editorPreviewVideo.style.filter = style;
      els.editorPreviewVideo.currentTime = 0;
      els.editorPreviewVideo.playbackRate = Number(els.reelSpeed.value || 100) / 100;
      els.editorPreviewVideo.play().catch(() => {});
    } else {
      els.editorPreviewImage.src = src || "";
      els.editorPreviewImage.style.filter = style;
    }
  };

  if (file) {
    fileToDataUrl(file).then((src) => applySource(src));
  } else {
    applySource(mediaUrl);
  }
}

function matchesInterest(text, interests) {
  const haystack = `${text || ""}`.toLowerCase();
  return [...interests].some((term) => haystack.includes(term));
}

function scoreFeedPost(post, interests) {
  const engagement = ((post.likedBy || []).length * 3) + ((post.comments || []).length * 4) + ((post.savedBy || []).length * 5);
  const followBoost = (me()?.following || []).includes(post.author) ? 24 : 0;
  const interestBoost = matchesInterest(`${post.title} ${post.caption}`, interests) ? 32 : 0;
  return engagement + followBoost + interestBoost;
}

function scoreExploreReel(reel, interests) {
  const engagement =
    ((reel.likedBy || []).length * 3) +
    ((reel.comments || []).length * 4) +
    Number(reel.views || 0) +
    (Number(reel.shares || 0) * 6) +
    Math.round(Number(reel.completionRate || 0) / 4);
  const followBoost = (me()?.following || []).includes(reel.author) ? 16 : 0;
  const interestBoost = matchesInterest(`${reel.caption} ${reel.music} ${reel.location} ${reel.coverText}`, interests) ? 40 : 0;
  const queryBoost =
    state.exploreQuery &&
    matchesInterest(`${reel.caption} ${reel.music} ${reel.location} ${reel.coverText} ${reel.author}`, new Set([state.exploreQuery]))
      ? 60
      : 0;
  return engagement + followBoost + interestBoost + queryBoost;
}

function pickShareTarget(excludeUsername) {
  const options = (state.data?.users || [])
    .filter((account) => account.username !== me().username && account.username !== excludeUsername)
    .map((account) => account.username);
  if (!options.length) {
    alert("Paylasacak baska bir kullanici yok.");
    return null;
  }
  const choice = window.prompt(`Kime gonderilsin?\n${options.join("\n")}`, options[0]);
  if (!choice) return null;
  return options.find((username) => username.toLowerCase() === choice.trim().toLowerCase()) || null;
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) throw new Error(data.error || "request_failed");
  return data;
}

async function bootstrap() {
  try {
    state.data = await api("/api/bootstrap", { method: "GET", headers: {} });
    els.authScreen.classList.add("hidden");
    els.appScreen.classList.remove("hidden");
    render();
  } catch {
    state.data = null;
    els.appScreen.classList.add("hidden");
    els.authScreen.classList.remove("hidden");
  }
}

function setView(viewName) {
  document.querySelectorAll(".view").forEach((view) => {
    view.classList.toggle("active", view.dataset.view === viewName);
  });
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.target === viewName);
  });
  els.screenTitle.textContent =
    {
      home: "Ana Sayfa",
      explore: "Kesfet",
      reels: "Reels",
      create: "Olustur",
      notifications: "Bildirimler",
      messages: "Mesajlar",
      profile: "Profil",
      settings: "Ayarlar"
    }[viewName] || "Denizstagram";
}

function applyAuthMode() {
  const registerMode = state.authMode === "register";
  els.nameField.classList.toggle("hidden", !registerMode);
  els.emailField.classList.toggle("hidden", !registerMode);
  els.emailVerificationBlock.classList.toggle("hidden", !registerMode);
  els.authSubmitButton.textContent = registerMode ? "Kayit ol" : "Giris yap";
  els.authHint.textContent = registerMode
    ? "Kayit icin mail dogrulamasi ve captcha zorunlu."
    : "Giris icin dogrulamayi tamamla.";
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authMode === state.authMode);
  });
  state.pendingEmailVerification = null;
  if (els.emailCodeInput) els.emailCodeInput.value = "";
  if (els.emailVerificationHint) {
    els.emailVerificationHint.textContent = "Kayit olmadan once mail kodu gonderilmelidir.";
  }
  resetAuthChallenge();
}

function renderStories() {
  els.storiesRow.innerHTML = "";
  const stories = state.data?.stories || [];
  if (!stories.length) {
    els.storiesRow.innerHTML = empty("Henuz hikaye yok.");
    return;
  }
  stories.forEach((story, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "story-pill";
    button.innerHTML = `
      <div class="story-avatar-ring"><div class="avatar gradient-avatar">${avatarMarkup(story.owner)}</div></div>
      <span>${story.owner === me()?.username && index === 0 ? "Hikayen" : story.owner}</span>
    `;
    button.addEventListener("click", () => {
      els.storyModalImage.src = story.image || "";
      els.storyModalTitle.textContent = `@${story.owner}`;
      els.storyModalCaption.textContent = story.caption || "Hikaye";
      els.storyModal.classList.remove("hidden");
    });
    els.storiesRow.appendChild(button);
  });
}

function renderFeed() {
  els.feedList.innerHTML = "";
  const interestProfile = buildInterestProfile();
  const posts = [...(state.data?.posts || [])].sort((left, right) => scoreFeedPost(right, interestProfile) - scoreFeedPost(left, interestProfile));
  if (!posts.length) {
    els.feedList.innerHTML = empty("Henuz gonderi yok.");
    return;
  }
  posts.forEach((post) => {
    const node = els.feedCardTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".feed-avatar").innerHTML = avatarMarkup(post.author);
    node.querySelector(".post-author").textContent = `@${post.author}`;
    node.querySelector(".post-meta").textContent = post.dateLabel;
    node.querySelector(".media-frame").innerHTML = createMediaMarkup(post.media, post.title, "post-image");
    node.querySelector(".post-title").textContent = post.title;
    node.querySelector(".post-caption").innerHTML = linkifyText(post.caption);
    node.querySelector(".like-count").textContent = `${(post.likedBy || []).length} begeni`;
    node.querySelector(".post-comments-summary").textContent =
      (post.comments || []).length > 0 ? `${post.comments.length} yorumun tumunu gor` : "Ilk yorumu sen ekle";
    const likeButton = node.querySelector(".like-button");
    const saveButton = node.querySelector(".save-button");
    const shareButton = node.querySelector(".share-button");
    const commentButton = node.querySelector(".comment-toggle-button");
    const deleteButton = node.querySelector(".delete-button");
    const commentsPanel = node.querySelector(".comments-panel");
    const commentList = node.querySelector(".comment-list");
    const commentForm = node.querySelector(".comment-form");
    const commentInput = node.querySelector(".comment-input");
    likeButton.classList.toggle("liked", (post.likedBy || []).includes(me().username));
    saveButton.classList.toggle("liked", (post.savedBy || []).includes(me().username));
    likeButton.textContent = (post.likedBy || []).includes(me().username) ? "Begenildi" : "Begeni";
    saveButton.textContent = (post.savedBy || []).includes(me().username) ? "Kaydedildi" : "Kaydet";
    deleteButton.classList.toggle("hidden", post.author !== me().username);
    commentList.innerHTML = (post.comments || []).length
      ? post.comments.map((comment) => `<p><strong>@${comment.author}</strong> ${linkifyText(comment.text)}</p>`).join("")
      : empty("Henuz yorum yok.");
    likeButton.addEventListener("click", async () => mutate("/api/post/like", { id: post.id }));
    saveButton.addEventListener("click", async () => mutate("/api/post/save", { id: post.id }));
    shareButton.addEventListener("click", async () => {
      const target = pickShareTarget(post.author);
      if (!target) return;
      await mutate("/api/messages", {
        username: target,
        text: `@${post.author} gonderisini paylasti: ${post.title} - ${post.caption || ""}`.trim()
      });
      setView("messages");
    });
    commentButton.addEventListener("click", () => commentsPanel.classList.toggle("hidden"));
    deleteButton.addEventListener("click", async () => {
      if (!window.confirm("Bu gonderi silinsin mi?")) return;
      await mutate("/api/post/delete", { id: post.id });
    });
    commentForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!commentInput.value.trim()) return;
      await mutate("/api/post/comment", { id: post.id, text: commentInput.value.trim() });
    });
    els.feedList.appendChild(node);
  });
}

function renderReels() {
  els.reelsList.innerHTML = "";
  const interestProfile = buildInterestProfile();
  const reels = [...(state.data?.reels || [])].sort((left, right) => scoreExploreReel(right, interestProfile) - scoreExploreReel(left, interestProfile));
  if (!reels.length) {
    els.reelsList.innerHTML = empty("Henuz reels yok.");
    return;
  }
  reels.forEach((reel) => {
    const node = els.reelCardTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.reelId = reel.id;
    const likeButton = node.querySelector(".reel-like-button");
    const commentButton = node.querySelector(".reel-comment-button");
    const shareButton = node.querySelector(".reel-share-button");
    const audioButton = node.querySelector(".reel-audio-button");
    const commentsPanel = node.querySelector(".reel-comments-panel");
    const commentList = node.querySelector(".reel-comment-list");
    const commentForm = node.querySelector(".reel-comment-form");
    const commentInput = node.querySelector(".reel-comment-input");
    node.querySelector(".reel-media").innerHTML = createMediaMarkup(
      reel.media,
      reel.caption,
      isVideoMedia(reel.media) ? "reel-video" : "reel-image",
      reel.settings || {}
    );
    node.querySelector(".reel-author").textContent = `@${reel.author}`;
    node.querySelector(".reel-caption").innerHTML = linkifyText(reel.caption);
    node.querySelector(".reel-meta").textContent = [reel.music || "", reel.location || "", reel.coverText || ""]
      .filter(Boolean)
      .join(" - ");
    node.querySelector(".reel-comments-summary").textContent = (reel.comments || []).length
      ? `${reel.comments.length} yorum`
      : "Ilk yorumu sen ekle";
    node.querySelector(".reel-likes").textContent = `${(reel.likedBy || []).length} begeni`;
    node.querySelector(".reel-views").textContent = `${reel.views || 0} goruntuleme`;
    node.querySelector(".reel-shares").textContent = `${reel.shares || 0} paylasim`;
    node.querySelector(".reel-completion").textContent = `%${reel.completionRate || 0} tamamlama - ${reel.watchTime || 0} sn izleme`;
    commentList.innerHTML = (reel.comments || []).length
      ? reel.comments.map((comment) => `<p><strong>@${comment.author}</strong> ${linkifyText(comment.text)}</p>`).join("")
      : empty("Henuz yorum yok.");
    likeButton.classList.toggle("liked", (reel.likedBy || []).includes(me().username));
    likeButton.textContent = (reel.likedBy || []).includes(me().username) ? "Begenildi" : "Begeni";
    const reelVideo = node.querySelector(".reel-video");
    if (reelVideo) {
      reelVideo.playbackRate = Number(reel.settings?.speed || 100) / 100;
      reelVideo.addEventListener(
        "play",
        async () => {
          if (state.viewedReels.has(reel.id)) return;
          state.viewedReels.add(reel.id);
          await mutate("/api/reel/view", {
            id: reel.id,
            watchTime: Math.max(3, Number(reel.settings?.trimEnd || 15) - Number(reel.settings?.trimStart || 0)),
            completionRate: 72
          });
        },
        { once: true }
      );
    }
    likeButton.addEventListener("click", async () => mutate("/api/reel/like", { id: reel.id }));
    commentButton.addEventListener("click", () => commentsPanel.classList.toggle("hidden"));
    shareButton.addEventListener("click", async () => {
      const target = pickShareTarget(reel.author);
      if (!target) return;
      await mutate("/api/messages", {
        username: target,
        text: `@${reel.author} reels paylasti: ${reel.caption || reel.coverText || "Yeni reels"}`,
        reelId: reel.id
      });
      setView("messages");
    });
    audioButton.addEventListener("click", () => {
      window.alert(`Ses: ${reel.music || "Orijinal ses"}`);
    });
    commentForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!commentInput.value.trim()) return;
      await mutate("/api/reel/comment", { id: reel.id, text: commentInput.value.trim() });
    });
    els.reelsList.appendChild(node);
  });

  setupAutoScrollReels();
}

function followLabel(account) {
  if ((account.followers || []).includes(me().username)) return "Takibi Birak";
  if ((account.followRequests || []).includes(me().username)) return "Istek Gonderildi";
  return account.privateAccount ? "Takip Istegi" : "Takip Et";
}

function renderExplore() {
  els.exploreGrid.innerHTML = "";
  if (els.exploreReelsGrid) els.exploreReelsGrid.innerHTML = "";
  const interestProfile = buildInterestProfile();
  const exploreReels = [...(state.data?.reels || [])]
    .filter((reel) => isVideoMedia(reel.media))
    .filter((reel) => !state.exploreQuery || matchesInterest(`${reel.caption} ${reel.music} ${reel.location} ${reel.coverText} ${reel.author}`, new Set([state.exploreQuery])))
    .sort((left, right) => scoreExploreReel(right, interestProfile) - scoreExploreReel(left, interestProfile));

  if (els.exploreReelsGrid) {
    if (!exploreReels.length) {
      els.exploreReelsGrid.innerHTML = empty("Aramana uygun video bulunamadi.");
    } else {
      exploreReels.slice(0, 12).forEach((reel) => {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "explore-reel-card";
        card.innerHTML = `
          <div class="explore-reel-media">${createMediaMarkup(reel.media, reel.caption, isVideoMedia(reel.media) ? "reel-video" : "reel-image", reel.settings || {})}</div>
          <div class="explore-reel-overlay">
            <strong>@${reel.author}</strong>
            <span>${reel.music || "Orijinal ses"}</span>
          </div>
        `;
        card.addEventListener("click", () => {
          setView("reels");
          const target = [...els.reelsList.querySelectorAll(".reel-card")].find((node) => node.dataset.reelId === reel.id);
          target?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        els.exploreReelsGrid.appendChild(card);
      });
    }
  }

  if (els.friendMap) {
    els.friendMap.innerHTML = "";
    (state.data?.users || [])
      .filter((account) => account.username !== me().username)
      .slice(0, 6)
      .forEach((account, index) => {
        const pin = document.createElement("div");
        pin.className = "friend-map-pin";
        pin.style.left = `${18 + ((index * 17) % 70)}%`;
        pin.style.top = `${20 + ((index * 19) % 58)}%`;
        pin.innerHTML = `<div class="avatar gradient-avatar">${avatarMarkup(account)}</div><span>${account.lastLocation || account.username}</span>`;
        els.friendMap.appendChild(pin);
      });
  }
  const list = (state.data?.users || [])
    .filter((account) => account.username !== me().username)
    .sort((left, right) => {
      const leftScore = ((left.followers || []).length * 2) + (matchesInterest(`${left.username} ${left.bio}`, interestProfile) ? 12 : 0);
      const rightScore = ((right.followers || []).length * 2) + (matchesInterest(`${right.username} ${right.bio}`, interestProfile) ? 12 : 0);
      return rightScore - leftScore;
    });
  if (!list.length) {
    els.exploreGrid.innerHTML = empty("Baska kullanici yok.");
    return;
  }
  list.forEach((account, index) => {
    const card = document.createElement("article");
    card.className = index % 3 === 0 ? "explore-card large profile-card" : "explore-card profile-card";
    card.innerHTML = `
      <div class="explore-card-image gradient-avatar">${avatarMarkup(account)}</div>
      <div class="profile-card-body">
        <strong>@${account.username}</strong>
        <p>${account.privateAccount ? "Gizli hesap" : "Acik hesap"}</p>
        <button class="ghost-button follow-button">${followLabel(account)}</button>
      </div>
    `;
    card.querySelector(".follow-button").addEventListener("click", async () => mutate("/api/follow", { username: account.username }));
    els.exploreGrid.appendChild(card);
  });
}

let reelAutoTimer = null;
function setupAutoScrollReels() {
  if (reelAutoTimer) clearInterval(reelAutoTimer);
  if (!els.reelsList || state.data?.reels?.length < 2) return;
  reelAutoTimer = setInterval(() => {
    const cards = [...els.reelsList.querySelectorAll(".reel-card")];
    if (!cards.length) return;
    const current = cards.findIndex((card) => {
      const rect = card.getBoundingClientRect();
      return rect.top >= 0 && rect.top < window.innerHeight * 0.5;
    });
    const next = cards[(current + 1 + cards.length) % cards.length];
    next?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 5000);
}

function renderNotifications() {
  els.notificationList.innerHTML = "";
  const list = state.data?.notifications || [];
  if (!list.length) {
    els.notificationList.innerHTML = empty("Henuz bildirim yok.");
    return;
  }
  list.forEach((item) => {
    const row = document.createElement("div");
    row.className = "stack-item";
    row.innerHTML = `
      <div class="avatar gradient-avatar small">${avatarMarkup(item.actor)}</div>
      <div>
        <p><strong>@${item.actor}</strong> ${item.text}</p>
        <span>${item.time}</span>
      </div>
      ${item.type === "follow_request" ? '<button class="ghost-button accept-button">Kabul Et</button>' : ""}
    `;
    if (item.type === "follow_request") {
      row.querySelector(".accept-button").addEventListener("click", async () => mutate("/api/follow/accept", { username: item.actor }));
    }
    els.notificationList.appendChild(row);
  });
}

function conversationPartner(conversation) {
  return (conversation.participants || []).find((name) => name !== me().username) || me().username;
}

function renderMessages() {
  els.messageList.innerHTML = "";
  const list = state.data?.conversations || [];
  if (!list.length) {
    els.messageList.innerHTML = empty("Henuz mesaj yok.");
    els.chatTitle.textContent = "Mesaj yok";
    els.chatSubtitle.textContent = "Yeni sohbet baslat";
    els.chatThread.innerHTML = "";
    return;
  }
  const activeId = state.activeConversationId || list[0].id;
  state.activeConversationId = activeId;
  list.forEach((conversation) => {
    const partner = conversationPartner(conversation);
    const last = (conversation.messages || [])[conversation.messages.length - 1];
    const button = document.createElement("button");
    button.type = "button";
    button.className = "message-list-item";
    button.innerHTML = `
      <div class="avatar gradient-avatar small">${avatarMarkup(partner)}</div>
      <div>
        <strong>@${partner}</strong>
        <p>${last?.text || "Henuz mesaj yok"}</p>
      </div>
    `;
    button.classList.toggle("active", conversation.id === activeId);
    button.addEventListener("click", () => {
      state.activeConversationId = conversation.id;
      renderMessages();
    });
    els.messageList.appendChild(button);
  });
  const active = list.find((conversation) => conversation.id === state.activeConversationId) || list[0];
  const partner = conversationPartner(active);
  els.chatAvatar.innerHTML = avatarMarkup(partner);
  els.chatTitle.textContent = `@${partner}`;
  els.chatSubtitle.textContent = user(partner)?.privateAccount ? "Gizli hesap" : "Mesajlasma acik";
  els.chatThread.innerHTML = "";
  (active.messages || []).forEach((message) => {
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    bubble.classList.toggle("mine", message.sender === me().username);
    bubble.textContent = message.text;
    els.chatThread.appendChild(bubble);
  });
}

function renderProfile() {
  const account = me();
  els.composerHandle.textContent = `@${account.username}`;
  els.composerAvatar.innerHTML = avatarMarkup(account);
  els.profileName.textContent = `@${account.username}`;
  els.profileInitial.innerHTML = avatarMarkup(account);
  els.profileBio.textContent = account.bio || "Biyografi eklenmedi.";
  els.postCount.textContent = `${(state.data.posts || []).filter((post) => post.author === account.username).length}`;
  els.followerCount.textContent = `${(account.followers || []).length}`;
  els.followingCount.textContent = `${(account.following || []).length}`;
  els.settingsDisplayName.value = account.displayName || account.username;
  els.settingsBio.value = account.bio || "";
  els.settingsAvatar.value = account.avatar || "";
  els.settingsPrivate.checked = Boolean(account.privateAccount);
  document.querySelectorAll("[data-profile-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.profileTab === state.profileTab);
  });
  const posts = (state.data.posts || []).filter((post) => post.author === account.username);
  const reels = (state.data.reels || []).filter((reel) => reel.author === account.username);
  if (state.profileTab === "posts") {
    els.profileTabContent.innerHTML = posts.length
      ? posts
          .map(
            (post) =>
              `<div class="profile-grid-item">${createMediaMarkup(post.media, post.title, isVideoMedia(post.media) ? "reel-video" : "reel-image")}<span>${account.displayName}</span></div>`
          )
          .join("")
      : empty("Henuz gonderi yok.");
  } else if (state.profileTab === "reels") {
    els.profileTabContent.innerHTML = reels.length
      ? reels
          .map(
            (reel) =>
              `<div class="profile-grid-item tall">${createMediaMarkup(reel.media, reel.caption, isVideoMedia(reel.media) ? "reel-video" : "reel-image", reel.settings || {})}<span>${reel.music || "Reel"}</span></div>`
          )
          .join("")
      : empty("Henuz reels yok.");
  } else {
    els.profileTabContent.innerHTML = (state.data.taggedPosts || []).length
      ? state.data.taggedPosts
          .map(
            (post) =>
              `<div class="profile-grid-item">${createMediaMarkup(post.media, post.title, isVideoMedia(post.media) ? "reel-video" : "reel-image")}<span>@${post.author}</span></div>`
          )
          .join("")
      : empty("Henuz etiket yok.");
  }
}

function render() {
  applyAuthMode();
  if (!state.data?.me) return;
  if (els.exploreSearchInput && document.activeElement !== els.exploreSearchInput) {
    els.exploreSearchInput.value = state.exploreQuery;
  }
  renderStories();
  renderFeed();
  renderReels();
  renderExplore();
  renderNotifications();
  renderMessages();
  renderProfile();
}

async function fileToDataUrl(file) {
  if (!file) return null;
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function mutate(path, body) {
  state.data = await api(path, { method: "POST", body: JSON.stringify(body) });
  render();
}

els.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const body = {
    username: els.usernameInput.value.trim().toLowerCase(),
    displayName: els.displayNameInput.value.trim(),
    email: els.emailInput.value.trim().toLowerCase(),
    password: els.passwordInput.value.trim(),
    emailCode: els.emailCodeInput?.value.trim(),
    emailVerificationToken: state.pendingEmailVerification?.token || "",
    captchaInput: els.authChallengeInput.value.trim(),
    captchaToken: state.authChallenge?.token || "",
    captchaSignature: state.authChallenge?.signature || "",
    notRobot: Boolean(els.authRobotCheckbox.checked),
    website: els.authWebsiteInput.value.trim(),
    humanDelayMs: Date.now() - state.authChallengeStartedAt
  };
  try {
    if (state.authMode === "register") {
      await api("/api/register", { method: "POST", body: JSON.stringify(body) });
      await api("/api/login", { method: "POST", body: JSON.stringify(body) });
    } else {
      await api("/api/login", { method: "POST", body: JSON.stringify(body) });
    }
    await bootstrap();
  } catch (error) {
    els.authHint.textContent = authErrorMessage(error.message);
    resetAuthChallenge();
  }
});

els.sendEmailCodeButton?.addEventListener("click", async () => {
  const body = {
    email: els.emailInput.value.trim().toLowerCase(),
    captchaInput: els.authChallengeInput.value.trim(),
    captchaToken: state.authChallenge?.token || "",
    captchaSignature: state.authChallenge?.signature || "",
    notRobot: Boolean(els.authRobotCheckbox.checked),
    website: els.authWebsiteInput.value.trim(),
    humanDelayMs: Date.now() - state.authChallengeStartedAt
  };
  try {
    const result = await api("/api/auth/send-email-code", { method: "POST", body: JSON.stringify(body) });
    state.pendingEmailVerification = {
      token: result.verificationToken,
      email: body.email
    };
    els.emailVerificationHint.textContent = `Kod gonderildi: ${body.email}`;
    els.authHint.textContent = "Mail kodunu girip kayit islemini tamamla.";
    resetAuthChallenge();
  } catch (error) {
    els.emailVerificationHint.textContent = authErrorMessage(error.message);
    resetAuthChallenge();
  }
});

els.logoutButton.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST", body: "{}" });
  state.data = null;
  els.appScreen.classList.add("hidden");
  els.authScreen.classList.remove("hidden");
});

els.composeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = els.composeFile.files[0];
  const dataUrl = await fileToDataUrl(file);
  await mutate("/api/create", {
    type: state.composeType,
    title: els.composeTitle.value.trim(),
    caption: els.composeCaption.value.trim(),
    url: els.composeMedia.value.trim(),
    dataUrl,
    music: els.reelMusic.value.trim(),
    location: els.reelLocation.value.trim(),
    coverText: els.reelCoverText.value.trim(),
    reelSettings: {
      filter: els.reelFilter.value,
      brightness: els.reelBrightness.value,
      contrast: els.reelContrast.value,
      saturation: els.reelSaturation.value,
      voiceMode: els.reelVoiceMode.value,
      speed: els.reelSpeed.value,
      trimStart: els.reelTrimStart.value,
      trimEnd: els.reelTrimEnd.value
    }
  });
  els.composeForm.reset();
  syncEditorPreview();
  setView(state.composeType === "reel" ? "reels" : "home");
});

els.messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const active = (state.data?.conversations || []).find((item) => item.id === state.activeConversationId);
  if (!active) return;
  await mutate("/api/messages", {
    username: conversationPartner(active),
    text: els.messageInput.value.trim()
  });
  els.messageInput.value = "";
});

els.settingsForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await mutate("/api/profile", {
    displayName: els.settingsDisplayName.value.trim(),
    bio: els.settingsBio.value.trim(),
    avatar: els.settingsAvatar.value.trim(),
    dataUrl: await fileToDataUrl(els.settingsAvatarFile.files[0]),
    lastLocation: els.reelLocation.value.trim(),
    privateAccount: els.settingsPrivate.checked
  });
  els.settingsAvatarFile.value = "";
  setView("profile");
});

els.openMessagesButton.addEventListener("click", () => setView("messages"));
els.openNotificationsButton.addEventListener("click", () => setView("notifications"));
els.closeStoryButton.addEventListener("click", () => els.storyModal.classList.add("hidden"));
els.storyModal.addEventListener("click", (event) => {
  if (event.target === els.storyModal) els.storyModal.classList.add("hidden");
});

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", () => setView(item.dataset.target));
});
document.querySelectorAll("[data-open-compose]").forEach((button) => {
  button.addEventListener("click", () => setView("create"));
});
document.querySelectorAll("[data-compose-type]").forEach((button) => {
  button.addEventListener("click", () => {
    state.composeType = button.dataset.composeType;
    document.querySelectorAll("[data-compose-type]").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.composeType === state.composeType);
    });
    syncEditorPreview();
  });
});
document.querySelectorAll("[data-auth-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    state.authMode = button.dataset.authMode;
    applyAuthMode();
  });
});
document.querySelectorAll("[data-profile-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    state.profileTab = button.dataset.profileTab;
    renderProfile();
  });
});
document.querySelectorAll("[data-target='settings']").forEach((button) => {
  button.addEventListener("click", () => setView("settings"));
});
els.refreshCaptchaButton?.addEventListener("click", () => {
  resetAuthChallenge();
});

applyAuthMode();
bootstrap();
state.interestTerms = loadInterestTerms();
[
  els.composeTitle,
  els.composeMedia,
  els.composeFile,
  els.reelMusic,
  els.reelLocation,
  els.reelCoverText,
  els.reelFilter,
  els.reelBrightness,
  els.reelContrast,
  els.reelSaturation,
  els.reelVoiceMode,
  els.reelSpeed
].forEach((input) => {
  input?.addEventListener("input", syncEditorPreview);
  input?.addEventListener("change", syncEditorPreview);
});
els.exploreSearchInput?.addEventListener("input", (event) => {
  state.exploreQuery = event.target.value.trim().toLowerCase();
  saveInterestTerm(state.exploreQuery);
  renderExplore();
});
syncEditorPreview();
resetAuthChallenge();
