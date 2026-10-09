(() => {
  const { createClient } = window.supabase;
  const configured = window.SUPABASE_URL !== "YOUR_SUPABASE_URL"
    && window.SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";
  const client = configured ? createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY) : null;
  const form = document.getElementById("bookingForm");
  const button = form.querySelector("button[type='submit']");
  const status = document.getElementById("bookingStatus");
  const dateField = form.elements.date;
  const availabilityGrid = document.getElementById("availabilityGrid");
  const availabilityMonthLabel = document.getElementById("availabilityMonth");
  const availabilityMessage = document.getElementById("availabilityMessage");
  let unavailableDates = new Set();
  let availabilityMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const localDate = (value) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  function renderAvailabilityCalendar() {
    availabilityGrid.replaceChildren();
    availabilityMonthLabel.textContent = availabilityMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((day) => {
      const heading = document.createElement("span");
      heading.className = "availability-weekday";
      heading.textContent = day;
      availabilityGrid.append(heading);
    });
    const first = new Date(availabilityMonth.getFullYear(), availabilityMonth.getMonth(), 1);
    const start = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
    for (let i = 0; i < 42; i += 1) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const key = dateKey(date);
      const inMonth = date.getMonth() === availabilityMonth.getMonth();
      const taken = unavailableDates.has(key);
      const day = document.createElement("button");
      day.type = "button";
      day.className = "availability-day";
      day.textContent = String(date.getDate());
      day.dataset.date = key;
      day.disabled = !inMonth || taken;
      if (!inMonth) day.classList.add("is-outside");
      if (taken) day.classList.add("is-taken");
      if (key === dateField.value) day.classList.add("is-selected");
      day.setAttribute("aria-label", `${date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}${taken ? ", unavailable" : ", available"}`);
      day.setAttribute("aria-disabled", String(day.disabled));
      availabilityGrid.append(day);
    }
  }

  async function loadAvailability() {
    if (!client) {
      availabilityMessage.textContent = "Date availability is unavailable. Please contact Dan Visuals before booking.";
      renderAvailabilityCalendar();
      return;
    }
    const { data, error } = await client.rpc("public_booking_unavailable_dates");
    if (error) {
      availabilityMessage.textContent = "We can’t display taken dates right now. You can still send an inquiry.";
      renderAvailabilityCalendar();
      return;
    }
    unavailableDates = new Set((data || []).map((item) => item.event_date));
    availabilityMessage.textContent = unavailableDates.has(dateField.value)
      ? "That date is already taken. Please choose an available date."
      : "Dates marked Taken are already booked or unavailable.";
    renderAvailabilityCalendar();
  }

  const selectedPackage = new URLSearchParams(window.location.search).get("package");
  if (selectedPackage && [...form.elements.package.options].some((option) => option.value === selectedPackage)) {
    form.elements.package.value = selectedPackage;
  }

  document.getElementById("availabilityPrevious").addEventListener("click", () => {
    availabilityMonth = new Date(availabilityMonth.getFullYear(), availabilityMonth.getMonth() - 1, 1);
    renderAvailabilityCalendar();
  });
  document.getElementById("availabilityNext").addEventListener("click", () => {
    availabilityMonth = new Date(availabilityMonth.getFullYear(), availabilityMonth.getMonth() + 1, 1);
    renderAvailabilityCalendar();
  });
  availabilityGrid.addEventListener("click", (event) => {
    const day = event.target.closest("button[data-date]");
    if (!day || day.disabled) return;
    dateField.value = day.dataset.date;
    status.textContent = "";
    dateField.dispatchEvent(new Event("change", { bubbles: true }));
    renderAvailabilityCalendar();
  });
  dateField.addEventListener("change", () => {
    const value = dateField.value;
    if (value) {
      const date = localDate(value);
      availabilityMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    }
    if (unavailableDates.has(value)) {
      availabilityMessage.textContent = "That date is already taken. Please choose an available date.";
    } else {
      availabilityMessage.textContent = "Dates marked Taken are already booked or unavailable.";
    }
    renderAvailabilityCalendar();
  });

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
    if (unavailableDates.has(dateField.value)) {
      status.textContent = "That date is already taken. Please choose an available date.";
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
      payment: values.get("payment")
    };

    button.disabled = true;
    status.textContent = "Sending your inquiry…";
    let error;
    try {
      ({ error } = await client.from("bookings").insert(booking));
    } catch {
      error = new Error("Request failed");
    } finally {
      button.disabled = false;
    }
    if (error) {
      console.error("Booking insert failed:", error);
      if (error.message?.includes("already taken") || error.message?.includes("This date is unavailable")) {
        status.textContent = "That date is already taken. Please choose an available date.";
        unavailableDates.add(dateField.value);
        renderAvailabilityCalendar();
        return;
      }
      status.textContent = "We couldn’t send your inquiry. Please try again or contact Dan Visuals directly.";
      return;
    }
    status.textContent = "Your inquiry was sent. Thank you! I’ll be in touch soon.";
    form.reset();
    renderAvailabilityCalendar();
  });

  renderAvailabilityCalendar();
  loadAvailability();
})();
