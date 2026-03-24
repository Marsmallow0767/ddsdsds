const state = {
  authMode: "login",
  composeType: "post",
  profileTab: "posts",
  data: null
};

const $ = (id) => document.getElementById(id);
const els = {
  authScreen: $("authScreen"),
  appScreen: $("appScreen"),
  authForm: $("authForm"),
  usernameInput: $("usernameInput"),
  displayNameInput: $("displayNameInput"),
  passwordInput: $("passwordInput"),
  authSubmitButton: $("authSubmitButton"),
  authHint: $("authHint"),
  nameField: $("nameField"),
  screenTitle: $("screenTitle"),
  storiesRow: $("storiesRow"),
  composerHandle: $("composerHandle"),
  composerAvatar: $("composerAvatar"),
  feedList: $("feedList"),
  reelsList: $("reelsList"),
  exploreGrid: $("exploreGrid"),
  notificationList: $("notificationList"),
  composeForm: $("composeForm"),
  composeTitle: $("composeTitle"),
  composeCaption: $("composeCaption"),
  composeMedia: $("composeMedia"),
  composeFile: $("composeFile"),
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
  els.authSubmitButton.textContent = registerMode ? "Kayit ol" : "Giris yap";
  els.authHint.textContent = registerMode
    ? "Yeni hesaplar sunucu tarafinda kaydedilir."
    : "Kayit oldugun hesapla giris yap.";
  document.querySelectorAll("[data-auth-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.authMode === state.authMode);
  });
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
  const posts = [...(state.data?.posts || [])].reverse();
  if (!posts.length) {
    els.feedList.innerHTML = empty("Henuz gonderi yok.");
    return;
  }
  posts.forEach((post) => {
    const node = els.feedCardTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".feed-avatar").innerHTML = avatarMarkup(post.author);
    node.querySelector(".post-author").textContent = `@${post.author}`;
    node.querySelector(".post-meta").textContent = post.dateLabel;
    node.querySelector(".post-image").src = post.media;
    node.querySelector(".post-image").alt = post.title;
    node.querySelector(".post-title").textContent = post.title;
    node.querySelector(".post-caption").textContent = post.caption;
    node.querySelector(".like-count").textContent = `${(post.likedBy || []).length} begeni`;
    node.querySelector(".post-comments-summary").textContent =
      (post.comments || []).length > 0 ? `${post.comments.length} yorumun tumunu gor` : "Ilk yorumu sen ekle";
    const likeButton = node.querySelector(".like-button");
    const saveButton = node.querySelector(".save-button");
    const shareButton = node.querySelector(".share-button");
    const commentButton = node.querySelector(".comment-toggle-button");
    const commentsPanel = node.querySelector(".comments-panel");
    const commentList = node.querySelector(".comment-list");
    const commentForm = node.querySelector(".comment-form");
    const commentInput = node.querySelector(".comment-input");
    likeButton.classList.toggle("liked", (post.likedBy || []).includes(me().username));
    saveButton.classList.toggle("liked", (post.savedBy || []).includes(me().username));
    likeButton.textContent = (post.likedBy || []).includes(me().username) ? "Begenildi" : "Begeni";
    saveButton.textContent = (post.savedBy || []).includes(me().username) ? "Kaydedildi" : "Kaydet";
    commentList.innerHTML = (post.comments || []).length
      ? post.comments.map((comment) => `<p><strong>@${comment.author}</strong> ${comment.text}</p>`).join("")
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
  const reels = [...(state.data?.reels || [])].reverse();
  if (!reels.length) {
    els.reelsList.innerHTML = empty("Henuz reels yok.");
    return;
  }
  reels.forEach((reel) => {
    const node = els.reelCardTemplate.content.firstElementChild.cloneNode(true);
    const likeButton = node.querySelector(".reel-like-button");
    const commentButton = node.querySelector(".reel-comment-button");
    const commentsPanel = node.querySelector(".reel-comments-panel");
    const commentList = node.querySelector(".reel-comment-list");
    const commentForm = node.querySelector(".reel-comment-form");
    const commentInput = node.querySelector(".reel-comment-input");
    node.querySelector(".reel-image").src = reel.media;
    node.querySelector(".reel-author").textContent = `@${reel.author}`;
    node.querySelector(".reel-caption").textContent = reel.caption;
    node.querySelector(".reel-comments-summary").textContent = (reel.comments || []).length
      ? `${reel.comments.length} yorum`
      : "Ilk yorumu sen ekle";
    node.querySelector(".reel-likes").textContent = `${(reel.likedBy || []).length} begeni`;
    node.querySelector(".reel-views").textContent = `${reel.views || 0} goruntuleme`;
    commentList.innerHTML = (reel.comments || []).length
      ? reel.comments.map((comment) => `<p><strong>@${comment.author}</strong> ${comment.text}</p>`).join("")
      : empty("Henuz yorum yok.");
    likeButton.classList.toggle("liked", (reel.likedBy || []).includes(me().username));
    likeButton.textContent = (reel.likedBy || []).includes(me().username) ? "Begenildi" : "Begeni";
    likeButton.addEventListener("click", async () => mutate("/api/reel/like", { id: reel.id }));
    commentButton.addEventListener("click", () => commentsPanel.classList.toggle("hidden"));
    commentForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!commentInput.value.trim()) return;
      await mutate("/api/reel/comment", { id: reel.id, text: commentInput.value.trim() });
    });
    els.reelsList.appendChild(node);
  });
}

function followLabel(account) {
  if ((account.followers || []).includes(me().username)) return "Takibi Birak";
  if ((account.followRequests || []).includes(me().username)) return "Istek Gonderildi";
  return account.privateAccount ? "Takip Istegi" : "Takip Et";
}

function renderExplore() {
  els.exploreGrid.innerHTML = "";
  const list = (state.data?.users || []).filter((account) => account.username !== me().username);
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
      ? posts.map((post) => `<div class="profile-grid-item"><img src="${post.media}" alt="${post.title}" /><span>${account.displayName}</span></div>`).join("")
      : empty("Henuz gonderi yok.");
  } else if (state.profileTab === "reels") {
    els.profileTabContent.innerHTML = reels.length
      ? reels.map((reel) => `<div class="profile-grid-item tall"><img src="${reel.media}" alt="${reel.caption}" /><span>Reel</span></div>`).join("")
      : empty("Henuz reels yok.");
  } else {
    els.profileTabContent.innerHTML = (state.data.taggedPosts || []).length
      ? state.data.taggedPosts.map((post) => `<div class="profile-grid-item"><img src="${post.media}" alt="${post.title}" /><span>@${post.author}</span></div>`).join("")
      : empty("Henuz etiket yok.");
  }
}

function render() {
  applyAuthMode();
  if (!state.data?.me) return;
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
    password: els.passwordInput.value.trim()
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
    els.authHint.textContent = error.message;
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
    dataUrl
  });
  els.composeForm.reset();
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
    privateAccount: els.settingsPrivate.checked
  });
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

applyAuthMode();
bootstrap();
