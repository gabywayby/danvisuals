(() => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window;
  if (!window.supabase || !SUPABASE_URL || !SUPABASE_ANON_KEY) return;
  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  });
  const grid = document.querySelector("#portfolio .wedding-grid");
  if (!grid) return;
  const filterBar = document.getElementById("portfolioFilters");
  const allowedCategories = new Set(["wedding", "debut", "birthday", "maternity", "engagement", "other"]);

  function updateFilters() {
    const cards = [...grid.querySelectorAll(".wedding")];
    const existing = new Set(cards.map((card) => card.dataset.category));
    filterBar.querySelectorAll(".portfolio-filter").forEach((pill) => {
      const category = pill.dataset.category;
      pill.hidden = category !== "all" && !existing.has(category);
      pill.setAttribute("aria-pressed", String(pill.classList.contains("is-active")));
    });
    const selected = filterBar.querySelector(".portfolio-filter.is-active")?.dataset.category || "all";
    cards.forEach((card) => { card.hidden = selected !== "all" && card.dataset.category !== selected; });
  }

  filterBar.addEventListener("click", (event) => {
    const pill = event.target.closest(".portfolio-filter");
    if (!pill || pill.hidden) return;
    filterBar.querySelectorAll(".portfolio-filter").forEach((item) => {
      const active = item === pill;
      item.classList.toggle("is-active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    const selected = pill.dataset.category;
    grid.querySelectorAll(".wedding").forEach((card) => {
      card.hidden = selected !== "all" && card.dataset.category !== selected;
    });
  });

  const formatWeddingDate = (value) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  };

  async function appendManagedWeddings() {
    const { data: weddings, error } = await client.from("weddings")
      .select("id, couple_names, event_date, location, category")
      .eq("is_published", true)
      .order("event_date", { ascending: false });
    if (error || !weddings?.length) return;
    const { data: photos, error: photosError } = await client.from("wedding_gallery_photos")
      .select("wedding_id, storage_path, position")
      .in("wedding_id", weddings.map((wedding) => wedding.id))
      .order("position", { ascending: true });
    if (photosError) return;
    const covers = new Map();
    (photos || []).forEach((photo) => {
      if (!covers.has(photo.wedding_id)) covers.set(photo.wedding_id, photo.storage_path);
    });
    weddings.forEach((wedding) => {
      const cover = covers.get(wedding.id);
      if (!cover) return;
      const card = document.createElement("a");
      card.className = "wedding";
      const category = allowedCategories.has(wedding.category) ? wedding.category : "other";
      card.dataset.category = category;
      card.href = `wedding-gallery.html?id=${encodeURIComponent(wedding.id)}`;
      const image = document.createElement("img");
      image.src = client.storage.from("wedding-gallery").getPublicUrl(cover).data.publicUrl;
      image.alt = `${wedding.couple_names} wedding`;
      image.loading = "lazy";
      const caption = document.createElement("div");
      caption.className = "caption";
      const name = document.createElement("h3");
      name.textContent = wedding.couple_names;
      const date = document.createElement("span");
      date.textContent = formatWeddingDate(wedding.event_date);
      caption.append(name, date);
      card.append(image, caption);
      grid.append(card);
    });
    updateFilters();
  }

  grid.querySelectorAll(".wedding").forEach((card) => {
    if (!card.dataset.category) card.dataset.category = "wedding";
  });
  updateFilters();
  appendManagedWeddings();
})();
