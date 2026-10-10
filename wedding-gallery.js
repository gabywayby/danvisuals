(() => {
  const title = document.getElementById("weddingTitle");
  const details = document.getElementById("weddingDetails");
  const status = document.getElementById("galleryStatus");
  const gallery = document.getElementById("managedGallery");
  const lightbox = document.getElementById("lightbox");
  const lightboxImage = lightbox.querySelector("img");
  const imageUrls = [];
  let currentImage = 0;

  function formatDate(value) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }

  function showImage(index) {
    currentImage = (index + imageUrls.length) % imageUrls.length;
    lightboxImage.src = imageUrls[currentImage];
    lightboxImage.alt = `${title.textContent} wedding photo ${currentImage + 1}`;
  }

  function openLightbox(index) {
    showImage(index);
    lightbox.classList.add("open");
    lightbox.querySelector(".close").focus();
  }

  function closeLightbox() {
    lightbox.classList.remove("open");
  }

  async function loadGallery() {
    if (!window.supabase || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      status.textContent = "This gallery is temporarily unavailable.";
      return;
    }
    const client = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });
    const weddingId = new URLSearchParams(location.search).get("id");
    if (!weddingId) {
      status.textContent = "This gallery could not be found.";
      return;
    }
    const { data: wedding, error } = await client.from("weddings")
      .select("id, couple_names, event_date, location")
      .eq("id", weddingId).eq("is_published", true).maybeSingle();
    if (error || !wedding) {
      status.textContent = "This gallery could not be found.";
      return;
    }
    title.textContent = wedding.couple_names;
    document.title = `${wedding.couple_names} | Dan Visuals`;
    details.textContent = `${formatDate(wedding.event_date)}${wedding.location ? ` · ${wedding.location}` : ""}`;
    const { data: photos, error: photoError } = await client.from("wedding_gallery_photos")
      .select("storage_path, position")
      .eq("wedding_id", wedding.id)
      .order("position", { ascending: true }).order("created_at", { ascending: true });
    if (photoError || !photos?.length) {
      status.textContent = "There are no photos in this gallery yet.";
      return;
    }
    photos.forEach((photo, index) => {
      const imageUrl = client.storage.from("wedding-gallery").getPublicUrl(photo.storage_path).data.publicUrl;
      imageUrls.push(imageUrl);
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = `${wedding.couple_names} wedding photo ${index + 1}`;
      image.loading = "lazy";
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", `Open photo ${index + 1}`);
      image.addEventListener("click", () => openLightbox(index));
      image.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openLightbox(index);
        }
      });
      gallery.append(image);
    });
    status.textContent = "";
  }

  lightbox.querySelector(".close").addEventListener("click", closeLightbox);
  lightbox.querySelector(".prev").addEventListener("click", () => showImage(currentImage - 1));
  lightbox.querySelector(".next").addEventListener("click", () => showImage(currentImage + 1));
  lightbox.addEventListener("click", (event) => { if (event.target === lightbox) closeLightbox(); });
  document.addEventListener("keydown", (event) => {
    if (!lightbox.classList.contains("open")) return;
    if (event.key === "Escape") closeLightbox();
    if (event.key === "ArrowLeft") showImage(currentImage - 1);
    if (event.key === "ArrowRight") showImage(currentImage + 1);
  });
  document.getElementById("year").textContent = new Date().getFullYear();
  loadGallery();
})();
