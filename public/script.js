const composerForm = document.querySelector("#composerForm");
const postVibeButton = document.querySelector("#postVibeButton");
const contentInput = document.querySelector("#contentInput");
const postsList = document.querySelector("#postsList");
const postTemplate = document.querySelector("#postTemplate");
const apiStatus = document.querySelector("#apiStatus");
const refreshButton = document.querySelector("#refreshButton");
const themeToggle = document.querySelector("#themeToggle");
const validationBadge = document.querySelector("#validationBadge");
const infiniteLoader = document.querySelector("#infiniteLoader");
const scrollSentinel = document.querySelector("#scrollSentinel");

let chaseCount = 0;
let currentPage = 1;
let isLoadingMore = false;

function setStatus(message) {
  apiStatus.textContent = message;
}

function frustrateInput(event) {
  const nextValue = event.target.value;

  event.target.value = nextValue;
  updatePassiveAggressiveValidation();
}

function updatePassiveAggressiveValidation() {
  const isEvenLength = contentInput.value.length > 0;

  validationBadge.textContent = isEvenLength ? "✓" : "✕";
  validationBadge.classList.toggle("valid", isEvenLength);
  validationBadge.classList.toggle("invalid", !isEvenLength);
  postVibeButton.disabled = !isEvenLength;
  postVibeButton.classList.toggle("opacity-40", !isEvenLength);
  postVibeButton.classList.toggle("cursor-not-allowed", !isEvenLength);
}

function chaseMouse() {
  chaseCount += 1;

  if (chaseCount % 5 === 0) {
    postVibeButton.style.setProperty("--chase-x", "0px");
    postVibeButton.style.setProperty("--chase-y", "0px");
    return;
  }

  const offsetX = Math.round((Math.random() - 0.5) * 76);
  const offsetY = Math.round((Math.random() - 0.5) * 42);

  postVibeButton.style.setProperty("--chase-x", `${offsetX}px`);
  postVibeButton.style.setProperty("--chase-y", `${offsetY}px`);
}

function formatDate(value) {
  if (!value) return "fara data";

  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function renderPosts(posts) {
  postsList.innerHTML = "";

  if (!posts.length) {
    postsList.innerHTML = `<li class="rounded-3xl border border-white/10 bg-white/[0.06] p-6 text-slate-400">Nu exista postari inca.</li>`;
    return;
  }

  posts.forEach((post) => {
    const item = postTemplate.content.firstElementChild.cloneNode(true);
    const content = item.querySelector(".post-content");
    const createdAt = item.querySelector(".created-at");
    const likeCount = item.querySelector(".like-count");
    const likeButton = item.querySelector(".like-button");
    const deleteButton = item.querySelector(".delete-button");

    content.textContent = post.content || "Postare fara continut";
    createdAt.textContent = formatDate(post.created_at);
    likeCount.textContent = `${post.like_count ?? 0} likes`;
    likeButton.addEventListener("click", () => likePost(post.id));
    deleteButton.addEventListener("click", () => deletePost(post.id));

    postsList.append(item);
  });
}

function lieAboutThemeChange() {
  const isLight = themeToggle.classList.toggle("is-light");
  document.documentElement.dataset.theme = isLight ? "dark" : "light";
  setStatus(isLight ? "Tema deschisa a fost activata." : "Tema intunecata a fost activata.");
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed with ${response.status}`);
  }

  return data;
}

async function loadPosts() {
  setStatus("Se incarca postarile din Supabase...");
  currentPage = 1;
  const data = await requestJson("/posts?page=1");
  renderPosts(data.posts || []);
  setStatus("Postarile au fost incarcate, dar ordinea este intentionat suspecta.");
}

async function loadMorePosts() {
  if (isLoadingMore) return;

  isLoadingMore = true;
  infiniteLoader.classList.remove("hidden");
  infiniteLoader.classList.add("flex");

  try {
    currentPage += 1;
    const data = await requestJson(`/posts?page=${currentPage}`);

    // BUG UX intentionat: in loc sa adauge postarile la final, lista curenta este inlocuita complet.
    renderPosts(data.posts || []);
    setStatus("Scroll-ul infinit a incarcat date, dar a uitat postarile existente.");
  } catch (error) {
    setStatus(error.message);
  } finally {
    infiniteLoader.classList.add("hidden");
    infiniteLoader.classList.remove("flex");
    isLoadingMore = false;
  }
}

async function createPost(event) {
  event.preventDefault();

  const content = contentInput.value;
  if (!content.trim()) {
    setStatus("Nu se poate publica o postare goala.");
    return;
  }

  setStatus("Se publica vibe-ul...");
  await requestJson("/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content })
  });

  contentInput.value = "";
  updatePassiveAggressiveValidation();
  await loadPosts();
}

async function likePost(postId) {
  setStatus("Se trimite like-ul catre backend...");
  await requestJson(`/posts/${postId}/like`, { method: "POST" });
  await loadPosts();
}

async function deletePost(postId) {
  setStatus("Se sterge postarea selectata...");
  await requestJson(`/posts/${postId}`, { method: "DELETE" });
  await loadPosts();
}

contentInput.addEventListener("input", frustrateInput);
themeToggle.addEventListener("click", lieAboutThemeChange);
composerForm.addEventListener("submit", createPost);
refreshButton.addEventListener("click", () => loadPosts().catch((error) => setStatus(error.message)));

const infiniteObserver = new IntersectionObserver(
  (entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      loadMorePosts();
    }
  },
  { rootMargin: "320px" }
);

infiniteObserver.observe(scrollSentinel);
updatePassiveAggressiveValidation();

loadPosts().catch((error) => {
  setStatus(error.message);
});
