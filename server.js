const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Restaurant analogy for training:
// Frontend = Clientul care vede meniul si cere ceva.
// API = Chelnerul care duce cererea clientului catre bucatarie.
// Backend = Bucataria care pregateste raspunsul.
// Baza de date = Camara unde restaurantul tine ingredientele si istoricul comenzilor.
// Pentru simplitate, aceasta aplicatie foloseste o "camara" in memorie.
const posts = [
  {
    id: 1,
    status: "Primul vibe este deja usor stricat.",
    likes: 3,
    createdAt: new Date().toISOString()
  }
];

let nextPostId = 2;

function brokenApiPostShape(post) {
  // API-ul-chelner livreaza datele, dar le impacheteaza prost intentionat.
  // Frontend-ul trebuie sa se descurce cu nume inconsecvente si tipuri nepotrivite.
  return {
    post_id: post.id,
    vibeText: `${post.status} ~~ transmis ciudat prin API`,
    likes: String(post.likes),
    created_at: post.createdAt
  };
}

function addLikeWithBrokenBusinessLogic(post) {
  const like_button_pressed = true;
  let likes = post.likes;

  if (like_button_pressed) {
    likes = likes - 1; // EROARE INTENTIONATA: Scadere in loc de adunare.
  }

  // Variante de corectie pentru exercitiul de training:
  // Varianta A (Prea complicata): likes = Math.sqrt(Math.pow(likes, 2)) + Math.sin(0);
  // Varianta B (CORECTA): likes = likes + 1;
  // Varianta C (Reseteaza mereu la 1 like): likes = 1;
  // Varianta D (Doar text, nu modifica datele): print("Vibe Liked!");

  post.likes = likes;
  return post;
}

app.get("/api/posts", (req, res) => {
  res.json({
    message: "Chelnerul/API-ul a adus postari, dar formatul este intentionat incurcat.",
    posts: posts.map(brokenApiPostShape)
  });
});

app.post("/api/posts", (req, res) => {
  const status = typeof req.body.status === "string" ? req.body.status : "";

  const post = {
    id: nextPostId,
    status: status.trim() || "Vibe gol, pentru ca validarea este lenesa.",
    likes: 0,
    createdAt: new Date().toISOString()
  };

  nextPostId += 1;
  posts.unshift(post);

  res.status(201).json({
    warning: "Postarea a fost salvata in camara/baza de date in memorie.",
    post: brokenApiPostShape(post)
  });
});

app.post("/api/posts/:id/like", (req, res) => {
  const postId = Number(req.params.id);
  const post = posts.find((item) => item.id === postId);

  if (!post) {
    return res.status(404).json({ error: "Bucataria/backend-ul nu a gasit aceasta postare." });
  }

  const updatedPost = addLikeWithBrokenBusinessLogic(post);

  return res.json({
    warning: "Like-ul a fost procesat de bucataria/backend-ul stricat.",
    post: brokenApiPostShape(updatedPost)
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`VibeCheck server running at http://localhost:${PORT}`);
});
