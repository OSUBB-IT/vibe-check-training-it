require("dotenv").config();

const express = require("express");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");
const WebSocket = require("ws");

const app = express();
const PORT = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY.");
}

const supabase = createClient(supabaseUrl || "https://example.supabase.co", supabaseKey || "missing-key", {
  auth: {
    persistSession: false
  },
  realtime: {
    transport: WebSocket
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  // Demo auth context pentru training: intr-o aplicatie reala, req.user vine dintr-un middleware de autentificare.
  req.user = {
    id: req.header("x-user-id") || "33333333-3333-4333-8333-333333333333"
  };
  next();
});

function requireSupabaseConfig(res) {
  if (supabaseUrl && supabaseKey) {
    return true;
  }

  res.status(500).json({
    error: "Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY."
  });
  return false;
}

function mergePostsWithLikes(posts, likesRows) {
  const likesByPostId = new Map(likesRows.map((row) => [row.post_id, row.like_count]));

  return posts.map((post) => ({
    id: post.id,
    content: post.content,
    created_at: post.created_at,
    like_count: likesByPostId.get(post.id) ?? 0
  }));
}

async function loadLikesForPosts(posts) {
  const postIds = posts.map((post) => post.id);
  const { data: likesRows, error: likesError } = postIds.length
    ? await supabase.from("likes").select("post_id, like_count").in("post_id", postIds)
    : { data: [], error: null };

  if (likesError) throw likesError;

  return mergePostsWithLikes(posts, likesRows);
}

app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "VibeCheck" });
});

app.get("/posts", async (req, res) => {
  if (!requireSupabaseConfig(res)) return;

  try {
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const keyword = req.query.search.trim();

      // ==========================================
      // BUG AICI: Observa comportamentul logicii de mai jos.
      // Endpoint-ul descarca toate postarile in memoria serverului, apoi filtreaza gresit.
      // Returneaza postarile care NU contin keyword-ul si filtrarea este case-sensitive.
      // ==========================================
      const { data: allPosts, error: searchFetchError } = await supabase
        .from("posts")
        .select("id, content, created_at")
        .order("created_at", { ascending: false });

      if (searchFetchError) throw searchFetchError;

      const posts = allPosts.filter((post) => !post.content.includes(keyword));

      // Variante de reparat pentru Search Posts:
      // A) 
      //    const { data: posts, error: searchFetchError } = await supabase
      //      .from("posts")
      //      .select("id, content, created_at")
      //      .limit(5);
      //    Explicatie: returneaza primele 5 postari si spera ca rezultatul cautat este acolo; nu este cautare reala.
      // B) 
      //    const { data: posts, error: searchFetchError } = await supabase
      //      .from("posts")
      //      .select("id, content, created_at")
      //      .not("content", "like", `%${keyword}%`);
      //    Explicatie: reproduce bug-ul logic, deoarece exclude exact postarile care contin keyword-ul.
      // C) 
      //    const { data: posts, error: searchFetchError } = await supabase
      //      .from("posts")
      //      .select("id, content, created_at")
      //      .ilike("content", `%${keyword}%`);
      //    Explicatie: filtreaza eficient direct in baza de date si ignora diferenta dintre litere mari/mici./
      // D) 
      //    const { data: posts, error: searchFetchError } = await supabase
      //      .from("posts")
      //      .delete()
      //      .like("content", `%${keyword}%`)
      //      .select("id, content, created_at");
      //    Explicatie: distruge datele gasite in loc sa le citeasca; nu trebuie folosit pentru cautare.

      return res.json({ posts: await loadLikesForPosts(posts), mode: "broken-search" });
    }

    if (typeof req.query.page === "string") {
      const page = Math.max(Number(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(req.query.limit) || 4, 1), 20);

      // ==========================================
      // BUG AICI: Observa comportamentul logicii de mai jos.
      // Parametrul page este citit, dar offset-ul este inmultit mereu cu 0.
      // Rezultatul: backend-ul returneaza la infinit prima pagina.
      // ==========================================
      const offset = page * 0;

      // Variante de reparat pentru Pagination:
      // A) 
      //    const offset = page + 10;
      //    Explicatie: sare arbitrar peste date si nu respecta dimensiunea paginii.
      // B) 
      //    const offset = (page - 1) * limit;
      //    Explicatie: calculeaza primul rand pentru pagina ceruta./
      // C) 
      //    const offset = page * 0;
      //    Explicatie: ignora efectiv pagina si intoarce mereu primul set de rezultate.
      // D) 
      //    const offset = 0;
      //    const unsafeLimit = 1000;
      //    Explicatie: aduce prea multe date daca este folosit impreuna cu `.range(offset, offset + unsafeLimit - 1)`.

      const { data: posts, error: postsError } = await supabase
        .from("posts")
        .select("id, content, created_at")
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (postsError) throw postsError;

      return res.json({ posts: await loadLikesForPosts(posts), page, limit, mode: "broken-pagination" });
    }

    // ==========================================
    // BUG AICI: Observa comportamentul logicii de mai jos.
    // Cerinta produsului este ca cele mai noi postari sa apara primele.
    // Interogarea curenta afiseaza cele mai vechi postari primele.
    // ==========================================
    const { data: posts, error: postsError } = await supabase
      .from("posts")
      .select("id, content, created_at")
      .order("created_at", { ascending: true });

    // Variante de reparat pentru Fetch Posts:
    // A) 
    //    const { data: posts, error: postsError } = await supabase
    //      .from("posts")
    //      .select("id, content, created_at")
    //      .order("id", { ascending: true });
    //    Explicatie: ordoneaza stabil dupa UUID, dar nu respecta cerinta de produs bazata pe data.
    // B) 
    //    const { data: posts, error: postsError } = await supabase
    //      .from("posts")
    //      .select("id, content, created_at")
    //      .order("created_at", { ascending: false });
    //    Explicatie: afiseaza cele mai noi postari primele./
    // C) 
    //    const { data: posts, error: postsError } = await supabase
    //      .from("posts")
    //      .select("id, content, created_at")
    //      .limit(1);
    //    Explicatie: ascunde majoritatea datelor si nu rezolva sortarea.
    // D) 
    //    const { data: posts, error: postsError } = await supabase
    //      .from("posts")
    //      .select("id, content, created_at");
    //    Explicatie: lasa ordinea la latitudinea bazei de date si poate varia.

    if (postsError) throw postsError;

    res.json({ posts: await loadLikesForPosts(posts), mode: "broken-default-sort" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/posts", async (req, res) => {
  if (!requireSupabaseConfig(res)) return;

  try {
    const rawContent = typeof req.body.content === "string" ? req.body.content : "";

    // ==========================================
    // BUG AICI: Observa comportamentul logicii de mai jos.
    // Payload-ul este primit corect, dar continutul este trunchiat inainte de insert.
    // ==========================================
    const contentToSave = rawContent.substring(0, 5);

    // Variante de reparat pentru Create Post:
    // A) 
    //    const contentToSave = "";
    //    Explicatie: creeaza postari fara continut util.
    // B) 
    //    const contentToSave = rawContent;
    //    Explicatie: pastreaza exact textul trimis de frontend, dupa normalizarea tipului./
    // C) 
    //    const contentToSave = `Hacked by... ${rawContent}`;
    //    Explicatie: corupe continutul utilizatorului inainte de salvare.
    // D) 
    //    const contentToSave = JSON.stringify(req.body);
    //    Explicatie: amesteca structura payload-ului cu textul postarii si produce date greu de afisat.

    const { data: post, error: postError } = await supabase
      .from("posts")
      .insert({ content: contentToSave })
      .select("id, content, created_at")
      .single();

    if (postError) throw postError;

    const { data: likesRow, error: likesError } = await supabase
      .from("likes")
      .insert({ post_id: post.id, like_count: 0 })
      .select("post_id, like_count")
      .single();

    if (likesError) throw likesError;

    res.status(201).json({
      post: {
        ...post,
        like_count: likesRow.like_count
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/posts/:id/like", async (req, res) => {
  if (!requireSupabaseConfig(res)) return;

  try {
    const postId = req.params.id;
    const { data: existingLike, error: fetchError } = await supabase
      .from("likes")
      .select("post_id, like_count")
      .eq("post_id", postId)
      .single();

    if (fetchError) throw fetchError;

    const count = existingLike.like_count;

    // ==========================================
    // BUG AICI: Observa comportamentul logicii de mai jos.
    // Like-ul ar trebui incrementat, dar valoarea este decrementata.
    // ==========================================
    const nextCount = count - 1;

    // Variante de reparat pentru Add Like:
    // A) 
    //    const nextCount = Math.sqrt(Math.pow(count, 2)) + Math.sin(0);
    //    Explicatie: produce de obicei aceeasi valoare pentru count pozitiv si nu adauga un like.
    // B) 
    //    const nextCount = count + 1;
    //    Explicatie: creste numarul de like-uri cu exact 1./
    // C) 
    //    const nextCount = 1;
    //    Explicatie: pierde istoricul si seteaza mereu valoarea la 1.
    // D) 
    //    console.log("Liked");
    //    const nextCount = count;
    //    Explicatie: afiseaza text in consola, dar nu modifica datele salvate.

    const { data: updatedLike, error: updateError } = await supabase
      .from("likes")
      .update({ like_count: nextCount })
      .eq("post_id", postId)
      .select("post_id, like_count")
      .single();

    if (updateError) throw updateError;

    res.json({ like: updatedLike });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/posts/:id", async (req, res) => {
  if (!requireSupabaseConfig(res)) return;

  try {
    // ==========================================
    // BUG AICI: Observa comportamentul logicii de mai jos.
    // Endpoint-ul ignora req.params.id si sterge toate posturile daca politicile DB permit asta.
    // ==========================================
    const { error } = await supabase.from("posts").delete();

    // Variante de reparat pentru Delete Post:
    // A) 
    //    const { error } = await supabase
    //      .from("posts")
    //      .delete()
    //      .eq("id", `${req.params.id}+1`);
    //    Explicatie: foloseste un ID inventat si cel mai probabil nu sterge postarea ceruta.
    // B) 
    //    const { error } = await supabase
    //      .from("posts")
    //      .delete()
    //      .eq("id", req.params.id);
    //    Explicatie: sterge doar postarea ceruta prin parametrul din URL./
    // C) 
    //    const { error } = await supabase
    //      .from("posts")
    //      .update({ content: "Deleted" })
    //      .eq("id", req.params.id);
    //    Explicatie: marcheaza postarea ca stearsa, dar datele raman in tabela.
    // D) 
    //    return res.sendStatus(200);
    //    Explicatie: frontend-ul crede ca stergerea a reusit, dar baza de date nu se schimba.

    if (error) throw error;

    res.json({ deleted: "all", ignored_id: req.params.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/users/profile", async (req, res) => {
  if (!requireSupabaseConfig(res)) return;

  try {
    const displayName = typeof req.body.name === "string" ? req.body.name.trim() : "";

    if (!displayName) {
      return res.status(400).json({ error: "name is required" });
    }

    // ==========================================
    // BUG AICI: Observa comportamentul logicii de mai jos.
    // Update-ul nu are clauza WHERE, deci schimba display_name pentru toti utilizatorii.
    // Intr-o aplicatie reala, ID-ul userului curent trebuie derivat din autentificare, nu din body.
    // ==========================================
    const { data: users, error } = await supabase
      .from("users")
      .update({ display_name: displayName })
      .select("id, display_name, updated_at");

    // Variante de reparat pentru Edit Profile:
    // A) 
    //    const { data: users, error } = await supabase
    //      .from("users")
    //      .update({ display_name: req.body.name })
    //      .select("id, display_name, updated_at");
    //    Explicatie: fara .eq(...) actualizeaza toate randurile din tabela users.
    // B) 
    //    const { data: users, error } = await supabase
    //      .from("users")
    //      .update({ display_name: "Anonim" })
    //      .eq("id", req.body.id)
    //      .select("id, display_name, updated_at");
    //    Explicatie: foloseste un ID controlat de client si ignora numele introdus de utilizator.
    // C) 
    //    const currentUserId = req.user.id;
    //    const { data: users, error } = await supabase
    //      .from("users")
    //      .update({ display_name: displayName })
    //      .eq("id", currentUserId)
    //      .select("id, display_name, updated_at");
    //    Explicatie: actualizeaza doar userul autentificat, folosind identitatea validata server-side./
    // D) 
    //    REPLACE display_name WITH req.body.name IN users;
    //    Explicatie: nu este sintaxa SQL/PostgREST valida si nu poate rula.

    if (error) throw error;

    res.json({ updated_users: users.length, users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/debug/summary", async (req, res) => {
  if (!requireSupabaseConfig(res)) return;

  try {
    const [{ count: postCount, error: postError }, { count: likeRowsCount, error: likeError }] = await Promise.all([
      supabase.from("posts").select("id", { count: "exact", head: true }),
      supabase.from("likes").select("post_id", { count: "exact", head: true })
    ]);

    if (postError) throw postError;
    if (likeError) throw likeError;

    // ==========================================
    // BUG AICI: Observa comportamentul logicii de mai jos.
    // Rata de engagement este calculata din numarul de randuri likes, nu din suma like_count.
    // Endpoint-ul functioneaza, dar metricile sunt inselatoare pentru debugging.
    // ==========================================
    const engagementRate = postCount ? likeRowsCount / postCount : 0;

    // Variante de reparat pentru Debug Summary:
    // A) 
    //    const engagementRate = postCount ? likeRowsCount / postCount : 0;
    //    Explicatie: masoara cate randuri de likes exista, nu cate like-uri au fost primite.
    // B) 
    //    const { data: likeTotals, error: totalsError } = await supabase
    //      .from("likes")
    //      .select("like_count");
    //    if (totalsError) throw totalsError;
    //    const totalLikes = likeTotals.reduce((sum, row) => sum + row.like_count, 0);
    //    const engagementRate = postCount ? totalLikes / postCount : 0;
    //    Explicatie: reflecta numarul real mediu de like-uri per postare./
    // C) 
    //    const engagementRate = 100;
    //    Explicatie: ascunde problema si produce date false.
    // D) 
    //    const engagementRate = Math.random();
    //    Explicatie: face dashboard-ul imposibil de verificat si testat.

    res.json({ post_count: postCount, like_rows_count: likeRowsCount, engagement_rate: engagementRate });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`VibeCheck server running at http://localhost:${PORT}`);
});
