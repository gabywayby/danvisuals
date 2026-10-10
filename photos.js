(() => {
  const form = document.getElementById("photosForm");
  document.getElementById("year").textContent = String(new Date().getFullYear());
  const message = document.getElementById("photosMessage");
  const result = document.getElementById("photosResult");
  const configured = window.SUPABASE_URL !== "YOUR_SUPABASE_URL"
    && window.SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";
  const client = configured ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  }) : null;

  form.elements.code.addEventListener("input", () => {
    form.elements.code.value = form.elements.code.value.toUpperCase().replace(/[^A-HJ-NP-Z2-9]/g, "").slice(0, 10);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    result.replaceChildren();
    if (!client) {
      message.textContent = "Photo lookup is not configured yet. Please contact Dan Visuals.";
      return;
    }
    const submit = form.querySelector("button[type='submit']");
    submit.disabled = true;
    message.textContent = "Looking for your gallery…";
    const values = new FormData(form);
    const { data, error } = await client.rpc("find_my_photos", {
      p_code: String(values.get("code") || "").trim().toUpperCase(),
      p_email: String(values.get("email") || "").trim()
    });
    submit.disabled = false;
    if (error || !data?.length) {
      message.textContent = "No delivered gallery was found for those details. Check your code and email, or contact Dan Visuals.";
      return;
    }
    const gallery = data[0];
    let url;
    try {
      url = new URL(gallery.delivery_url);
    } catch {
      message.textContent = "The gallery link is unavailable right now. Please contact Dan Visuals.";
      return;
    }
    if (url.protocol !== "https:" || !["drive.google.com", "docs.google.com"].includes(url.hostname) || url.username || url.password) {
      message.textContent = "The gallery link is unavailable right now. Please contact Dan Visuals.";
      return;
    }
    const heading = document.createElement("h2");
    heading.textContent = `Your photos, ${gallery.name}`;
    const details = document.createElement("p");
    const date = new Date(`${gallery.event_date}T00:00`).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    details.textContent = `${gallery.event} · ${date}`;
    const link = document.createElement("a");
    link.className = "btn";
    link.href = url.href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "Open photo gallery";
    result.append(heading, details, link);
    result.classList.remove("hidden");
    message.textContent = "Gallery found.";
  });
})();
