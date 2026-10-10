(() => {
  const { createClient } = window.supabase;
  const configured = window.SUPABASE_URL !== "YOUR_SUPABASE_URL"
    && window.SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";
  const client = configured ? createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  }) : null;
  const form = document.getElementById("bookingForm");
  const button = form.querySelector("button[type='submit']");
  const status = document.getElementById("bookingStatus");
  const dateField = form.elements.date;
  const availabilityGrid = document.getElementById("availabilityGrid");
  const availabilityMonthLabel = document.getElementById("availabilityMonth");
  const availabilityMessage = document.getElementById("availabilityMessage");
  const addonsFieldset = document.getElementById("addonsFieldset");
  const addonsList = document.getElementById("addonsList");
  const addonsMessage = document.getElementById("addonsMessage");
  const estimatedTotal = document.getElementById("estimatedTotal");
  const PACKAGE_PRICES = { "wedding-standard": 8000, "wedding-premium": 10000, debut: 5000, birthday: 4000, maternity: 3000, engagement: 3000 };
  const BOOKING_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const addonsByCode = new Map();
  let unavailableDates = new Map();
  let availabilityMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const today = dateKey(new Date());
  dateField.min = today;
  const localDate = (value) => {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  };

  const formatPhp = (value) => `PHP ${new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 }).format(value)}`;
  function chosenAddons() {
    return [...addonsList.querySelectorAll("input[name='addons']:checked")]
      .map((input) => addonsByCode.get(input.value)).filter(Boolean);
  }
  function updateEstimatedTotal() {
    const packageCode = form.elements.package.value;
    if (!packageCode) {
      estimatedTotal.textContent = "Estimated total: Select a package";
      return;
    }
    if (!Object.hasOwn(PACKAGE_PRICES, packageCode)) {
      estimatedTotal.textContent = "Estimated total: To be discussed";
      return;
    }
    const total = PACKAGE_PRICES[packageCode] + chosenAddons().reduce((sum, addon) => sum + Number(addon.price), 0);
    estimatedTotal.textContent = `Estimated total: ${formatPhp(total)}`;
  }
  async function loadAddons() {
    if (!client) {
      addonsMessage.textContent = "Add-ons are unavailable right now.";
      addonsFieldset.disabled = false;
      return;
    }
    const { data, error } = await client.from("addons").select("code, label, price").eq("active", true).order("sort", { ascending: true });
    addonsFieldset.disabled = false;
    if (error) {
      addonsMessage.textContent = "Optional add-ons could not be loaded. You can still send an inquiry.";
      return;
    }
    addonsMessage.textContent = data?.length ? "Choose any extras you'd like." : "No optional add-ons are currently available.";
    (data || []).forEach((addon) => {
      addonsByCode.set(addon.code, addon);
      const label = document.createElement("label");
      label.className = "addon-option";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.name = "addons";
      input.value = addon.code;
      input.addEventListener("change", updateEstimatedTotal);
      const copy = document.createElement("span");
      copy.textContent = `${addon.label} · ${formatPhp(Number(addon.price))}`;
      label.append(input, copy);
      addonsList.append(label);
    });
    updateEstimatedTotal();
  }
  function generateBookingCode() {
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    return [...bytes].map((byte) => BOOKING_CODE_ALPHABET[byte & 31]).join("");
  }
  function addSummaryLine(container, labelText, valueText) {
    const line = document.createElement("p");
    const label = document.createElement("strong");
    label.textContent = `${labelText}: `;
    const value = document.createElement("span");
    value.textContent = valueText || "—";
    line.append(label, value);
    container.append(line);
  }
  function showSuccess(values, addons, bookingCode, estimate) {
    const panel = document.createElement("section");
    panel.className = "inquiry-success";
    panel.setAttribute("aria-labelledby", "inquirySentHeading");
    const eyebrow = document.createElement("p");
    eyebrow.className = "booking-eyebrow";
    eyebrow.textContent = "Thank you";
    const heading = document.createElement("h2");
    heading.id = "inquirySentHeading";
    heading.textContent = "Inquiry sent";
    const intro = document.createElement("p");
    intro.textContent = `Thanks, ${values.get("name")}. Your inquiry has been received.`;
    const summary = document.createElement("div");
    summary.className = "inquiry-summary";
    addSummaryLine(summary, "Package", form.elements.package.selectedOptions[0]?.textContent || "");
    addSummaryLine(summary, "Event", values.get("event"));
    addSummaryLine(summary, "Date", new Date(`${values.get("date")}T00:00`).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }));
    addSummaryLine(summary, "Time", values.get("time"));
    addSummaryLine(summary, "Location", values.get("location"));
    addSummaryLine(summary, "Add-ons", addons.length ? addons.map((addon) => `${addon.label} (${formatPhp(Number(addon.price))})`).join(", ") : "None");
    addSummaryLine(summary, "Estimated total", estimate == null ? "To be discussed" : formatPhp(estimate));
    const codeLine = document.createElement("p");
    const codeLabel = document.createElement("strong");
    codeLabel.textContent = "Booking code: ";
    const code = document.createElement("code");
    code.textContent = bookingCode;
    const copyButton = document.createElement("button");
    copyButton.className = "btn copy-booking-code";
    copyButton.type = "button";
    copyButton.textContent = "Copy code";
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(bookingCode);
        copyButton.textContent = "Copied";
        window.setTimeout(() => { copyButton.textContent = "Copy code"; }, 1800);
      } catch { copyButton.textContent = "Copy unavailable"; }
    });
    codeLine.append(codeLabel, code, copyButton);
    summary.append(codeLine);
    const nextHeading = document.createElement("h3");
    nextHeading.textContent = "What happens next";
    const steps = document.createElement("ol");
    ["I check availability and reply.", "We agree on the deposit and details.", "Your date is reserved once the deposit is received."].forEach((text) => {
      const item = document.createElement("li");
      item.textContent = text;
      steps.append(item);
    });
    const notReserved = document.createElement("p");
    notReserved.className = "date-not-reserved";
    notReserved.textContent = "Your date is NOT reserved yet. It will be reserved once your deposit is received.";
    const contact = document.createElement("div");
    contact.className = "inquiry-contact-actions";
    const messenger = document.createElement("a");
    messenger.className = "btn";
    messenger.href = window.CONTACT?.messenger || "https://m.me/YOUR_PAGE_USERNAME";
    messenger.textContent = "Message me on Messenger";
    messenger.target = "_blank";
    messenger.rel = "noopener noreferrer";
    const viberDigits = String(window.CONTACT?.viberNumber || "63XXXXXXXXXX").replace(/\D/g, "");
    const viber = document.createElement("a");
    viber.className = "btn";
    viber.href = `viber://chat?number=%2B${encodeURIComponent(viberDigits)}`;
    viber.textContent = "Message me on Viber";
    const photos = document.createElement("a");
    photos.href = "photos.html";
    photos.textContent = "Find my photos later";
    panel.append(eyebrow, heading, intro, summary, nextHeading, steps, notReserved, contact);
    contact.append(messenger, viber, photos);
    form.replaceWith(panel);
  }

  form.elements.package.addEventListener("change", updateEstimatedTotal);

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
      const availabilityStatus = unavailableDates.get(key);
      const unavailable = Boolean(availabilityStatus);
      const past = key < today;
      const day = document.createElement("button");
      day.type = "button";
      day.className = "availability-day";
      day.textContent = String(date.getDate());
      day.dataset.date = key;
      day.disabled = !inMonth || unavailable || past;
      if (!inMonth) day.classList.add("is-outside");
      if (availabilityStatus === "pending") day.classList.add("is-pending");
      if (availabilityStatus === "fully_booked") day.classList.add("is-fully-booked");
      if (past) day.classList.add("is-past");
      if (key === dateField.value) day.classList.add("is-selected");
      const availabilityLabel = past ? ", past date"
        : availabilityStatus === "pending" ? ", pending"
          : availabilityStatus === "fully_booked" ? ", fully booked"
            : ", available";
      day.setAttribute("aria-label", `${date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}${availabilityLabel}`);
      if (availabilityStatus) day.title = availabilityStatus === "pending" ? "Pending" : "Fully booked";
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
    unavailableDates = new Map((data || []).map((item) => [item.event_date, item.availability_status]));
    availabilityMessage.textContent = unavailableDates.has(dateField.value)
      ? `${unavailableDates.get(dateField.value) === "pending" ? "That date has a pending inquiry" : "That date is fully booked"}. Please choose another date.`
      : "Yellow dates are pending; red dates are fully booked.";
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
      availabilityMessage.textContent = `${unavailableDates.get(value) === "pending" ? "That date has a pending inquiry" : "That date is fully booked"}. Please choose another date.`;
    } else {
      availabilityMessage.textContent = "Yellow dates are pending; red dates are fully booked.";
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
    if (dateField.value < today) {
      status.textContent = "Please choose a date that is today or later.";
      return;
    }
    if (unavailableDates.has(dateField.value)) {
      status.textContent = "That date is already taken. Please choose an available date.";
      return;
    }

    const values = new FormData(form);
    const selectedAddons = chosenAddons();
    const estimatedBase = PACKAGE_PRICES[values.get("package")];
    const estimate = estimatedBase == null ? null : estimatedBase + selectedAddons.reduce((sum, addon) => sum + Number(addon.price), 0);
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
      addons: selectedAddons.map((addon) => addon.code),
      booking_code: generateBookingCode()
    };

    button.disabled = true;
    status.textContent = "Sending your inquiry…";
    let error;
    try {
      let result = await client.from("bookings").insert(booking);
      error = result.error;
      if (error?.code === "23505" && /booking_code/i.test(`${error.message || ""} ${error.details || ""} ${error.constraint || ""}`)) {
        booking.booking_code = generateBookingCode();
        result = await client.from("bookings").insert(booking);
        error = result.error;
      }
    } catch {
      error = new Error("Request failed");
    } finally {
      button.disabled = false;
    }
    if (error) {
      console.error("Booking insert failed:", error);
      if (error.message?.includes("already taken") || error.message?.includes("This date is unavailable")) {
        status.textContent = "That date is no longer available. Please choose another date.";
        unavailableDates.set(dateField.value, "fully_booked");
        renderAvailabilityCalendar();
        return;
      }
      const visitorMessages = ["Too many requests", "already sent an inquiry", "nearer date"];
      const visitorMessage = visitorMessages.find((message) => error.message?.toLowerCase().includes(message.toLowerCase()));
      if (visitorMessage) {
        status.textContent = error.message;
        return;
      }
      status.textContent = "We couldn’t send your inquiry. Please try again or contact Dan Visuals directly.";
      return;
    }
    showSuccess(values, selectedAddons, booking.booking_code, estimate);
  });

  renderAvailabilityCalendar();
  updateEstimatedTotal();
  loadAddons();
  loadAvailability();
})();
