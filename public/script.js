const postVibeButton = document.querySelector("#postVibeButton");
const statusInput = document.querySelector("#statusInput");
const postsList = document.querySelector("#postsList");
const apiStatus = document.querySelector("#apiStatus");

// In analogia restaurantului, acest fisier este clientul care vorbeste cu chelnerul/API-ul.
// API-ul functioneaza, dar intoarce date impachetate intentionat prost pentru exercitiu.
function normalizeBrokenApiPost(apiPost) {
  return {
    id: apiPost.post_id,
    status: apiPost.vibeText,
    likes: `${apiPost.likes} like-uri?`,
    createdAt: apiPost.created_at
  };
}

function sneakButtonAway() {
  const maxLeft = Math.max(window.innerWidth - 28, 8);
  const maxTop = Math.max(window.innerHeight - 28, 8);

  postVibeButton.style.left = `${Math.floor(Math.random() * maxLeft)}px`;
  postVibeButton.style.top = `${Math.floor(Math.random() * maxTop)}px`;
}

function renderPosts(posts) {
  postsList.innerHTML = "";

  posts.forEach((post) => {
    const item = document.createElement("li");
    item.className = "post-card";

    const text = document.createElement("p");
    text.className = "post-text";
    text.textContent = post.status;

    const likeButton = document.createElement("button");
    likeButton.className = "like-button";
    likeButton.type = "button";
    likeButton.textContent = "Like";
    likeButton.addEventListener("click", () => likePost(post.id));

    const likes = document.createElement("span");
    likes.className = "likes-count";
    likes.textContent = post.likes;

    item.append(text, likeButton, likes);
    postsList.append(item);
  });
}

async function loadPosts() {
  const response = await fetch("/api/posts");
  const data = await response.json();
  const posts = data.posts.map(normalizeBrokenApiPost);

  apiStatus.textContent = data.message;
  renderPosts(posts);
}

async function createPost() {
  const response = await fetch("/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: statusInput.value })
  });
  const data = await response.json();

  statusInput.value = "";
  apiStatus.textContent = data.warning;
  await loadPosts();
}

async function likePost(postId) {
  const response = await fetch(`/api/posts/${postId}/like`, { method: "POST" });
  const data = await response.json();

  apiStatus.textContent = data.warning;
  await loadPosts();
}

postVibeButton.addEventListener("mouseover", sneakButtonAway);
postVibeButton.addEventListener("focus", sneakButtonAway);
postVibeButton.addEventListener("click", createPost);

loadPosts().catch((error) => {
  apiStatus.textContent = `Chelnerul/API-ul a scapat tava: ${error.message}`;
});
