(() => {
  const { createClient } = window.supabase;
  const configured = window.SUPABASE_URL !== "YOUR_SUPABASE_URL"
    && window.SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";
  const client = configured ? createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null;
  const form = document.getElementById("bookingForm");
  const button = form.querySelector("button[type='submit']");
  const status = document.getElementById("bookingStatus");

  const selectedPackage = new URLSearchParams(window.location.search).get("package");
  if (selectedPackage && [...form.elements.package.options].some((option) => option.value === selectedPackage)) {
    form.elements.package.value = selectedPackage;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (form.elements._honey.value) {
      status.textContent = "Your inquiry was sent. Thank you! I’ll be in touch soon.";
      form.reset();
      return;
    }
    if (!client) {
      status.textContent = "Booking is not configured yet. Please contact Dan Visuals directly.";
      return;
    }

    const values = new FormData(form);
    const booking = {
      package: values.get("package"),
      name: values.get("name").trim(),
      phone: values.get("phone").trim(),
      email: values.get("email").trim(),
      event: values.get("event"),
      event_date: values.get("date"),
      event_time: values.get("time"),
      location: values.get("location").trim(),
      payment: values.get("payment"),
      status: "new"
    };

    button.disabled = true;
    status.textContent = "Sending your inquiry…";
    const { error } = await client.from("bookings").insert(booking);
    button.disabled = false;
    if (error) {
      status.textContent = "We couldn’t send your inquiry. Please try again or contact Dan Visuals directly.";
      return;
    }
    status.textContent = "Your inquiry was sent. Thank you! I’ll be in touch soon.";
    form.reset();
  });
})();
