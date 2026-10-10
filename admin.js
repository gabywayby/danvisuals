(() => {
  const configured = window.SUPABASE_URL !== "YOUR_SUPABASE_URL"
    && window.SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY";
  const loginPanel = document.getElementById("loginPanel");
  const dashboard = document.getElementById("dashboard");
  const loginForm = document.getElementById("loginForm");
  const loginMessage = document.getElementById("loginMessage");
  const dashboardMessage = document.getElementById("dashboardMessage");
  const signOutButton = document.getElementById("signOutButton");
  const bookingsBody = document.getElementById("bookingsBody");
  const emptyBookings = document.getElementById("emptyBookings");
  const bookingFilters = document.getElementById("bookingFilters");
  const bookingSearch = bookingFilters.querySelector('input[type="search"]');
  const calendarGrid = document.getElementById("calendarGrid");
  const selectedDayPanel = document.getElementById("selectedDayPanel");
  const calendarTitle = document.getElementById("calendarTitle");
  const blockedDateForm = document.getElementById("blockedDateForm");
  const blockedDateList = document.getElementById("blockedDateList");
  const weddingForm = document.getElementById("weddingForm");
  const weddingGalleryList = document.getElementById("weddingGalleryList");
  const galleryMessage = document.getElementById("galleryMessage");
  const emptyWeddings = document.getElementById("emptyWeddings");
  const nextWeekList = document.getElementById("nextWeekList");
  const clientList = document.getElementById("clientList");
  const clientSearch = document.getElementById("clientSearch");
  const emptyClients = document.getElementById("emptyClients");
  const addonAdminList = document.getElementById("addonAdminList");
  const addonAdminMessage = document.getElementById("addonAdminMessage");
  const invoicePrint = document.getElementById("invoicePrint");
  const statusOptions = ["new", "confirmed", "completed", "cancelled"];
  const galleryCategories = ["wedding", "debut", "birthday", "maternity", "engagement", "other"];
  const categoryLabel = (value) => value.charAt(0).toUpperCase() + value.slice(1);
  const TURNAROUND = { "wedding-standard": 4, "wedding-premium": 2, debut: 3, birthday: 3, maternity: 3, engagement: 3, other: 3 };
  const PACKAGE_PRICES = { "wedding-standard": 8000, "wedding-premium": 10000, debut: 5000, birthday: 4000, maternity: 3000, engagement: 3000 };
  const dueDate = (booking) => {
    const date = new Date(`${booking.event_date}T00:00`);
    date.setDate(date.getDate() + (TURNAROUND[booking.package] ?? 3));
    return date;
  };
  const toE164 = (phone) => {
    const digits = String(phone || "").replace(/\D/g, "");
    return digits.startsWith("63") ? `+${digits}` : digits.startsWith("0") ? `+63${digits.slice(1)}` : `+${digits}`;
  };
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const client = configured
    ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
    : null;
  let bookings = [];
  let blockedDates = [];
  let weddings = [];
  let weddingPhotos = new Map();
  let addons = [];
  let selectedDay;
  let activeBookingFilter = "all";
  let month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const localDate = (value) => {
    const [year, monthNumber, day] = value.split("-").map(Number);
    return new Date(year, monthNumber - 1, day);
  };
  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  selectedDay = dateKey(new Date());
  const formatDate = (value) => localDate(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const formatPhp = (value) => value == null ? "—" : new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(Number(value));
  const activeBookingsForDate = (value) => bookings.filter((item) => item.event_date === value && item.status !== "cancelled");
  const hasDateConflict = (value) => activeBookingsForDate(value).length > 1;
  const make = (tag, className, value) => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (value != null) element.textContent = String(value);
    return element;
  };

  function applyBookingFilters() {
    const query = bookingSearch.value.trim().toLocaleLowerCase();
    let visible = 0;
    bookingsBody.querySelectorAll(".booking-card").forEach((card) => {
      const booking = bookings.find((item) => item.id === card.dataset.bookingId);
      const searchable = [booking?.name, booking?.email, booking?.phone, booking?.location]
        .join(" ").toLocaleLowerCase();
      const matches = (activeBookingFilter === "all" || card.dataset.status === activeBookingFilter)
        && (!query || searchable.includes(query));
      card.hidden = !matches;
      if (matches) visible += 1;
    });
    emptyBookings.textContent = bookings.length ? "No bookings match these filters." : "No bookings yet.";
    emptyBookings.classList.toggle("hidden", visible > 0);
  }

  function setSignedIn(isSignedIn) {
    loginPanel.classList.toggle("hidden", isSignedIn);
    dashboard.classList.toggle("hidden", !isSignedIn);
    signOutButton.classList.toggle("hidden", !isSignedIn);
  }

  function renderStats() {
    const today = dateKey(new Date());
    document.getElementById("statNew").textContent = bookings.filter((item) => item.status === "new").length;
    document.getElementById("statConfirmed").textContent = bookings.filter((item) => item.status === "confirmed").length;
    document.getElementById("statUpcoming").textContent = bookings.filter((item) => item.event_date >= today && !["cancelled", "completed"].includes(item.status)).length;
    document.getElementById("statTotal").textContent = bookings.length;
    document.getElementById("statOverdue").textContent = bookings.filter((booking) =>
      ["confirmed", "completed"].includes(booking.status) && !booking.delivery_url && dateKey(dueDate(booking)) < today
    ).length;
    renderNextWeek();
    renderRevenue();
    renderClients();
  }

  function renderNextWeek() {
    nextWeekList.replaceChildren();
    const today = localDate(dateKey(new Date()));
    const lastDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 6);
    const upcoming = bookings.filter((booking) => booking.status === "confirmed"
      && booking.event_date >= dateKey(today) && booking.event_date <= dateKey(lastDay))
      .sort((a, b) => a.event_date.localeCompare(b.event_date) || a.event_time.localeCompare(b.event_time));
    if (!upcoming.length) {
      nextWeekList.append(make("p", "next-week-empty", "No confirmed bookings in the next 7 days."));
      return;
    }
    upcoming.forEach((booking) => {
      const chip = make("button", "next-week-chip");
      chip.type = "button";
      chip.dataset.bookingId = booking.id;
      chip.append(make("strong", "", formatDate(booking.event_date)), make("span", "", booking.name), make("small", "", booking.event));
      nextWeekList.append(chip);
    });
  }

  function deliveryState(booking) {
    if (booking.delivery_url) return { text: "Delivered", className: "delivery-state is-delivered" };
    if (!["confirmed", "completed"].includes(booking.status)) return null;
    const deadline = dueDate(booking);
    const today = localDate(dateKey(new Date()));
    const deadlineKey = dateKey(deadline);
    const todayKey = dateKey(today);
    if (deadlineKey < todayKey) {
      const days = Math.floor((today - deadline) / 86400000);
      return { text: `Overdue ${days}d`, className: "delivery-state is-overdue" };
    }
    if (deadlineKey === todayKey) return { text: "Due today", className: "delivery-state is-due-today" };
    return { text: `Due ${formatDate(deadlineKey)}`, className: "delivery-state is-upcoming" };
  }

  const packageName = (value) => ({ "wedding-standard": "Wedding Standard", "wedding-premium": "Wedding Premium", debut: "Debut", birthday: "Birthday", maternity: "Maternity", engagement: "Engagement", other: "Other" }[value] || value || "");
  const addonDetails = (booking) => (booking.addons || []).map((code) => addons.find((item) => item.code === code) || { code, label: code, price: 0 });
  const displayDateTime = (date, time) => `${date.replaceAll("-", "")}T${String(time || "00:00").slice(0, 5).replace(":", "")}00`;
  const addHoursWallTime = (date, time, hours) => {
    const [year, monthNumber, day] = date.split("-").map(Number);
    const [hour, minute] = String(time || "00:00").slice(0, 5).split(":").map(Number);
    const value = new Date(Date.UTC(year, monthNumber - 1, day, hour + hours, minute));
    const pad = (part) => String(part).padStart(2, "0");
    return `${value.getUTCFullYear()}${pad(value.getUTCMonth() + 1)}${pad(value.getUTCDate())}T${pad(value.getUTCHours())}${pad(value.getUTCMinutes())}00`;
  };
  const escapeIcs = (value) => String(value || "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

  function googleCalendarUrl(booking) {
    const start = displayDateTime(booking.event_date, booking.event_time);
    const end = addHoursWallTime(booking.event_date, booking.event_time, 4);
    const detailText = `Package: ${packageName(booking.package)}${addonDetails(booking).length ? ` + ${addonDetails(booking).map((item) => item.label).join(", ")}` : ""}\nBooking code: ${booking.booking_code || ""}`;
    const params = new URLSearchParams({ action: "TEMPLATE", text: `${booking.event} · ${booking.name}`, dates: `${start}/${end}`, ctz: "Asia/Manila", location: booking.location || "", details: detailText });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  function downloadIcs(booking) {
    const start = displayDateTime(booking.event_date, booking.event_time);
    const end = addHoursWallTime(booking.event_date, booking.event_time, 4);
    const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const contents = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Dan Visuals//Booking//EN", "BEGIN:VEVENT", `UID:${escapeIcs(booking.id)}@danvisuals`, `DTSTAMP:${stamp}`, `DTSTART;TZID=Asia/Manila:${start}`, `DTEND;TZID=Asia/Manila:${end}`, `SUMMARY:${escapeIcs(`${booking.event} - ${booking.name}`)}`, `LOCATION:${escapeIcs(booking.location)}`, `DESCRIPTION:${escapeIcs(`Package: ${packageName(booking.package)}\nBooking code: ${booking.booking_code || ""}`)}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
    const url = URL.createObjectURL(new Blob([contents], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    const safeFilename = String(booking.booking_code || booking.id).replace(/[^A-Za-z0-9-]/g, "");
    link.download = `dan-visuals-${safeFilename}.ics`;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function printInvoice(booking) {
    invoicePrint.replaceChildren();
    const heading = make("h1", "", "Dan Visuals");
    const title = make("h2", "", "Booking invoice");
    const code = make("p", "", `Booking code: ${booking.booking_code || "—"}`);
    const clientHeading = make("h3", "", "Client");
    const clientDetails = make("p", "", `${booking.name}\n${booking.email}\n${booking.phone}`);
    const eventHeading = make("h3", "", "Event");
    const eventDetails = make("p", "", `${booking.event} · ${formatDate(booking.event_date)} · ${booking.event_time}\n${booking.location}`);
    const packageHeading = make("h3", "", "Package and extras");
    const items = document.createElement("ul");
    const basePrice = PACKAGE_PRICES[booking.package];
    items.append(make("li", "", `${packageName(booking.package)} · ${basePrice == null ? "To be discussed" : formatPhp(basePrice)}`));
    addonDetails(booking).forEach((addon) => items.append(make("li", "", `${addon.label} · ${formatPhp(addon.price)}`)));
    const total = make("p", "invoice-total", `Total: ${formatPhp(booking.total_price)}`);
    const paid = make("p", "", `Payment: ${booking.deposit_paid ? `Paid${booking.paid_at ? ` on ${new Date(booking.paid_at).toLocaleDateString()}` : ""}` : "Unpaid"}`);
    const phone = make("p", "", "Dan Visuals · (+63) 945-965-6105");
    invoicePrint.append(heading, title, code, clientHeading, clientDetails, eventHeading, eventDetails, packageHeading, items, total, paid, phone);
    window.print();
  }

  function renderRevenue() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const collectedThisMonth = bookings.filter((booking) => booking.deposit_paid && booking.paid_at
      && new Date(booking.paid_at) >= monthStart && new Date(booking.paid_at) < nextMonthStart)
      .reduce((sum, booking) => sum + Number(booking.total_price || 0), 0);
    const unpaid = bookings.filter((booking) => !booking.deposit_paid && booking.status !== "cancelled")
      .reduce((sum, booking) => sum + Number(booking.total_price || 0), 0);
    const countThisMonth = bookings.filter((booking) => {
      const created = new Date(booking.created_at);
      return created >= monthStart && created < nextMonthStart;
    }).length;
    document.getElementById("revenueCollected").textContent = formatPhp(collectedThisMonth);
    document.getElementById("revenueUnpaid").textContent = formatPhp(unpaid);
    document.getElementById("revenueBookings").textContent = String(countThisMonth);

    const byPackage = new Map();
    bookings.forEach((booking) => {
      const item = byPackage.get(booking.package) || { count: 0, total: 0 };
      item.count += 1;
      item.total += Number(booking.total_price || 0);
      byPackage.set(booking.package, item);
    });
    const table = document.getElementById("revenueByPackage");
    table.replaceChildren();
    const packageTable = document.createElement("table");
    packageTable.className = "revenue-package-table";
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    ["Package", "Bookings", "Total"].forEach((text) => headerRow.append(make("th", "", text)));
    thead.append(headerRow);
    const tbody = document.createElement("tbody");
    [...byPackage.entries()].sort(([a], [b]) => packageName(a).localeCompare(packageName(b))).forEach(([packageCode, item]) => {
      const row = document.createElement("tr");
      row.append(make("td", "", packageName(packageCode)), make("td", "", String(item.count)), make("td", "", formatPhp(item.total)));
      tbody.append(row);
    });
    packageTable.append(thead, tbody);
    table.append(packageTable);
    if (!byPackage.size) table.append(make("p", "day-panel-empty", "No booking revenue yet."));

    const chart = document.getElementById("revenueChart");
    chart.replaceChildren();
    const months = [];
    for (let offset = 5; offset >= 0; offset -= 1) {
      const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const finish = new Date(start.getFullYear(), start.getMonth() + 1, 1);
      const total = bookings.filter((booking) => booking.deposit_paid && booking.paid_at
        && new Date(booking.paid_at) >= start && new Date(booking.paid_at) < finish)
        .reduce((sum, booking) => sum + Number(booking.total_price || 0), 0);
      months.push({ label: start.toLocaleDateString(undefined, { month: "short" }), total });
    }
    const maximum = Math.max(1, ...months.map((item) => item.total));
    months.forEach((item) => {
      const bar = make("div", "revenue-bar-row");
      bar.append(make("span", "", item.label));
      const track = document.createElement("progress");
      track.className = "revenue-bar-track";
      track.max = 100;
      track.value = Math.max(0, item.total / maximum * 100);
      track.setAttribute("aria-label", `${item.label} collected`);
      bar.append(track, make("strong", "", formatPhp(item.total)));
      chart.append(bar);
    });
  }

  function renderClients() {
    const query = clientSearch.value.trim().toLocaleLowerCase();
    const grouped = new Map();
    bookings.forEach((booking) => {
      const key = String(booking.email || "").trim().toLocaleLowerCase();
      const list = grouped.get(key) || [];
      list.push(booking);
      grouped.set(key, list);
    });
    clientList.replaceChildren();
    let shown = 0;
    [...grouped.values()].forEach((items) => {
      items.sort((a, b) => b.event_date.localeCompare(a.event_date));
      const latest = items[0];
      const totalPaid = items.filter((booking) => booking.deposit_paid).reduce((sum, booking) => sum + Number(booking.total_price || 0), 0);
      const searchable = [latest.name, latest.email, latest.phone].join(" ").toLocaleLowerCase();
      if (query && !searchable.includes(query)) return;
      shown += 1;
      const details = make("details", "client-item");
      const summary = make("summary", "client-summary");
      summary.append(make("strong", "", latest.name || "Client"), make("span", "", latest.email || ""), make("span", "", latest.phone || ""), make("span", "", `${items.length} booking${items.length === 1 ? "" : "s"}`), make("span", "", `Last event ${formatDate(latest.event_date)}`), make("strong", "", `Paid ${formatPhp(totalPaid)}`));
      details.append(summary);
      const list = make("div", "client-bookings");
      items.forEach((booking) => {
        const row = make("p", "", `${formatDate(booking.event_date)} · ${booking.event} · ${booking.status} · ${booking.deposit_paid ? "Paid" : "Unpaid"}`);
        list.append(row);
      });
      details.append(list);
      clientList.append(details);
    });
    emptyClients.classList.toggle("hidden", shown > 0);
  }

  async function loadAddonSettings(showError = false) {
    const { data, error } = await client.from("addons").select("code, label, price, active, sort").order("sort", { ascending: true });
    if (error) {
      if (showError) addonAdminMessage.textContent = "Couldn’t load add-ons. Confirm migration 017 and admin access.";
      return false;
    }
    addons = data || [];
    renderAddonSettings();
    return true;
  }

  function renderAddonSettings() {
    addonAdminList.replaceChildren();
    addons.forEach((addon) => {
      const row = make("form", "addon-admin-row");
      row.dataset.code = addon.code;
      const code = make("strong", "addon-code", addon.code);
      const label = document.createElement("label");
      label.append(document.createTextNode("Label"));
      const labelInput = document.createElement("input");
      labelInput.name = "label";
      labelInput.value = addon.label;
      label.append(labelInput);
      const price = document.createElement("label");
      price.append(document.createTextNode("Price"));
      const priceInput = document.createElement("input");
      priceInput.name = "price";
      priceInput.type = "number";
      priceInput.min = "0";
      priceInput.step = "0.01";
      priceInput.value = String(addon.price);
      price.append(priceInput);
      const sort = document.createElement("label");
      sort.append(document.createTextNode("Sort"));
      const sortInput = document.createElement("input");
      sortInput.name = "sort";
      sortInput.type = "number";
      sortInput.step = "1";
      sortInput.value = String(addon.sort);
      sort.append(sortInput);
      const activeLabel = document.createElement("label");
      activeLabel.className = "addon-active-toggle";
      const active = document.createElement("input");
      active.name = "active";
      active.type = "checkbox";
      active.checked = Boolean(addon.active);
      activeLabel.append(active, document.createTextNode(" Active"));
      const save = make("button", "button save-addon", "Save");
      save.type = "submit";
      row.append(code, label, price, sort, activeLabel, save);
      addonAdminList.append(row);
    });
  }

  function renderTable() {
    const openDetails = new Set([...bookingsBody.querySelectorAll(".booking-card")]
      .filter((card) => card.querySelector(".booking-extra")?.open)
      .map((card) => card.dataset.bookingId));
    bookingsBody.replaceChildren();
    [...bookings].sort((a, b) => a.event_date.localeCompare(b.event_date) || String(a.id).localeCompare(String(b.id)))
      .forEach((booking) => {
      const status = statusOptions.includes(booking.status) ? booking.status : "new";
      const card = make("article", "booking-card");
      card.dataset.bookingId = booking.id;
      card.dataset.status = status;

      const date = localDate(booking.event_date);
      const dateBlock = make("div", "booking-date");
      dateBlock.append(make("strong", "", String(date.getDate()).padStart(2, "0")));
      dateBlock.append(make("span", "", date.toLocaleDateString(undefined, { month: "short" }).toUpperCase()));
      dateBlock.append(make("small", "", booking.event_time || ""));

      const info = make("div", "booking-info");
      info.append(make("h3", "", booking.name || ""));
      info.append(make("p", "booking-meta", `${booking.package || ""} · ${booking.event || ""}`));
      info.append(make("p", "booking-contact", `${booking.phone || ""} · ${booking.email || ""}`));
      info.append(make("p", "booking-location", booking.location || ""));
      const deliveryBadge = deliveryState(booking);
      if (deliveryBadge) info.append(make("span", deliveryBadge.className, deliveryBadge.text));
      if (booking.status === "new" && Date.now() - new Date(booking.created_at).getTime() > 48 * 60 * 60 * 1000) {
        info.append(make("span", "follow-up-badge", "Needs reply"));
      }
      if (hasDateConflict(booking.event_date)) {
        info.append(make("span", "date-conflict", "⚠ Date conflict"));
      }

      const side = make("div", "booking-side");
      const select = make("select", "status-select");
      select.setAttribute("aria-label", `Status for ${booking.name || "booking"}`);
      statusOptions.forEach((optionStatus) => {
        const option = make("option", "", optionStatus[0].toUpperCase() + optionStatus.slice(1));
        option.value = optionStatus;
        select.append(option);
      });
      select.value = status;
      side.append(select);
      const actions = make("div", "row-actions");
      const deleteButton = make("button", "button button-danger delete-booking");
      deleteButton.type = "button";
      deleteButton.setAttribute("aria-label", `Delete booking for ${booking.name || "client"}`);
      deleteButton.title = "Delete booking";
      const deleteIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      deleteIcon.setAttribute("viewBox", "0 0 24 24");
      deleteIcon.setAttribute("aria-hidden", "true");
      deleteIcon.setAttribute("focusable", "false");
      const deletePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      deletePath.setAttribute("d", "M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3");
      deletePath.setAttribute("fill", "none");
      deletePath.setAttribute("stroke", "currentColor");
      deletePath.setAttribute("stroke-linecap", "round");
      deletePath.setAttribute("stroke-linejoin", "round");
      deletePath.setAttribute("stroke-width", "1.8");
      deleteIcon.append(deletePath);
      deleteButton.append(deleteIcon);
      actions.append(deleteButton);
      side.append(actions);

      const details = make("details", "booking-extra");
      details.open = openDetails.has(String(booking.id));
      const summary = make("summary", "");
      const paymentBadge = booking.deposit_paid
        ? { cls: "is-paid", label: "Paid" }
        : { cls: "is-due", label: "Unpaid" };
      summary.append(make("span", "pay-summary", formatPhp(booking.total_price)));
      summary.append(make("span", `pay-badge ${paymentBadge.cls}`, paymentBadge.label));
      details.append(summary);
      const grid = make("div", "extra-grid");

      const payment = make("div", "extra-group");
      payment.append(make("h4", "", "Payment"));
      payment.append(make("p", "", `Total price: ${formatPhp(booking.total_price)}`));
      const paidLabel = document.createElement("label");
      paidLabel.className = "paid-toggle";
      const paid = document.createElement("input");
      paid.type = "checkbox";
      paid.className = "deposit-paid";
      paid.checked = Boolean(booking.deposit_paid);
      paidLabel.append(paid, document.createTextNode(" Paid"));
      const savePayment = document.createElement("button");
      savePayment.type = "button";
      savePayment.className = "button save-payment";
      savePayment.textContent = "Save";
      payment.append(paidLabel, savePayment);
      grid.append(payment);

      const delivery = make("div", "extra-group");
      delivery.append(make("h4", "", "Delivery"));
      const deliveryInput = document.createElement("input");
      deliveryInput.type = "url";
      deliveryInput.className = "delivery-url";
      deliveryInput.placeholder = "https://drive.google.com/…";
      deliveryInput.value = booking.delivery_url || "";
      deliveryInput.setAttribute("aria-label", `Google Drive delivery link for ${booking.name || "booking"}`);
      delivery.append(deliveryInput);
      const saveDelivery = make("button", "button save-delivery", "Save link");
      saveDelivery.type = "button";
      delivery.append(saveDelivery);
      if (booking.delivery_url && AdminSecurity.isDeliveryUrl(booking.delivery_url)) {
        const openLink = make("a", "subtext", "Open gallery");
        openLink.href = booking.delivery_url;
        openLink.target = "_blank";
        openLink.rel = "noopener noreferrer";
        delivery.append(openLink);
      }
      grid.append(delivery);

      const notesGroup = make("div", "extra-group wide");
      notesGroup.append(make("h4", "", "Notes"));
      const notesInput = document.createElement("textarea");
      notesInput.className = "booking-notes";
      notesInput.setAttribute("aria-label", `Admin notes for ${booking.name || "booking"}`);
      notesInput.value = booking.notes || "";
      const saveNotes = document.createElement("button");
      saveNotes.type = "button";
      saveNotes.className = "button save-notes";
      saveNotes.textContent = "Save notes";
      notesGroup.append(notesInput, saveNotes);
      grid.append(notesGroup);
      const reference = make("div", "extra-group wide booking-reference-group");
      reference.append(make("h4", "", "Booking details"));
      reference.append(make("p", "", `Booking code: ${booking.booking_code || "—"}`));
      const extras = addonDetails(booking);
      reference.append(make("p", "", `Add-ons: ${extras.length ? extras.map((item) => `${item.label} · ${formatPhp(item.price)}`).join(", ") : "None"}`));
      const calendarActions = make("div", "booking-calendar-actions");
      const calendarLink = make("a", "button", "Google Calendar");
      calendarLink.href = googleCalendarUrl(booking);
      calendarLink.target = "_blank";
      calendarLink.rel = "noopener noreferrer";
      calendarActions.append(calendarLink);
      const icsButton = make("button", "button download-ics", ".ics");
      icsButton.type = "button";
      icsButton.dataset.bookingId = booking.id;
      calendarActions.append(icsButton);
      const invoiceButton = make("button", "button print-invoice", "Invoice");
      invoiceButton.type = "button";
      invoiceButton.dataset.bookingId = booking.id;
      calendarActions.append(invoiceButton);
      reference.append(calendarActions);
      grid.append(reference);
      details.append(grid);

      card.append(dateBlock, info, side, details);
      bookingsBody.append(card);
    });
    applyBookingFilters();
  }

  function renderCalendar() {
    calendarGrid.replaceChildren();
    weekdays.forEach((weekday) => {
      const header = document.createElement("div");
      header.className = "calendar-weekday";
      header.textContent = weekday;
      calendarGrid.append(header);
    });
    calendarTitle.textContent = month.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const gridStart = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - firstDay.getDay());
    const today = dateKey(new Date());
    for (let index = 0; index < 42; index += 1) {
      const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index);
      const key = dateKey(date);
      const day = document.createElement("button");
      day.type = "button";
      day.className = "calendar-day";
      day.dataset.date = key;
      day.setAttribute("aria-pressed", String(key === selectedDay));
      if (date.getMonth() !== month.getMonth()) day.classList.add("is-outside");
      if (key === today) day.classList.add("is-today");
      if (key === selectedDay) day.classList.add("is-selected");
      const number = document.createElement("span");
      number.className = "day-number";
      number.textContent = date.getDate();
      day.append(number);
      const dayBookings = bookings.filter((booking) => booking.event_date === key);
      if (dayBookings.filter((booking) => booking.status !== "cancelled").length > 1) {
        const warning = document.createElement("span");
        warning.className = "calendar-conflict";
        warning.textContent = "Date conflict";
        day.append(warning);
      }
      dayBookings.forEach((booking) => {
        const chip = document.createElement("span");
        chip.className = `booking-chip status-${statusOptions.includes(booking.status) ? booking.status : "new"}`;
        chip.textContent = booking.name;
        chip.title = `${booking.name} · ${booking.event}`;
        day.append(chip);
      });
      calendarGrid.append(day);
    }
    renderDayPanel();
  }

  function renderDayPanel() {
    selectedDayPanel.replaceChildren();
    const heading = document.createElement("h3");
    heading.textContent = selectedDay ? formatDate(selectedDay) : "Select a date";
    selectedDayPanel.append(heading);
    const dayBookings = bookings.filter((booking) => booking.event_date === selectedDay);
    if (hasDateConflict(selectedDay)) {
      const warning = document.createElement("p");
      warning.className = "date-conflict panel-conflict";
      warning.textContent = "⚠ Multiple non-cancelled bookings share this date.";
      selectedDayPanel.append(warning);
    }
    if (!dayBookings.length) {
      const empty = document.createElement("p");
      empty.className = "day-panel-empty";
      empty.textContent = "No bookings for this date.";
      selectedDayPanel.append(empty);
      return;
    }
    dayBookings.forEach((booking) => {
      const card = document.createElement("article");
      card.className = "day-booking-card";
      const name = document.createElement("h4");
      name.textContent = booking.name;
      const detail = document.createElement("p");
      detail.textContent = `${booking.event} · ${booking.event_time} · ${booking.status}`;
      const actions = document.createElement("div");
      actions.className = "day-booking-actions";
      if (booking.status === "new") {
        const confirm = document.createElement("button");
        confirm.type = "button";
        confirm.className = "button quick-status";
        confirm.dataset.bookingId = booking.id;
        confirm.dataset.status = "confirmed";
        confirm.textContent = "Confirm";
        actions.append(confirm);
      }
      if (booking.status !== "cancelled") {
        const cancel = document.createElement("button");
        cancel.type = "button";
        cancel.className = "button button-quiet quick-status";
        cancel.dataset.bookingId = booking.id;
        cancel.dataset.status = "cancelled";
        cancel.textContent = "Cancel booking";
        actions.append(cancel);
      }
      card.append(name, detail, actions);
      selectedDayPanel.append(card);
    });
  }

  function renderBlockedDates() {
    blockedDateList.replaceChildren();
    blockedDates.forEach((item) => {
      const li = document.createElement("li");
      const date = document.createElement("span");
      date.textContent = formatDate(item.blocked_date);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.setAttribute("aria-label", `Remove blocked date ${formatDate(item.blocked_date)}`);
      remove.title = "Remove unavailable date";
      remove.dataset.blockedDateId = item.id;
      const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      icon.setAttribute("viewBox", "0 0 24 24");
      icon.setAttribute("aria-hidden", "true");
      icon.setAttribute("focusable", "false");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3");
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", "currentColor");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("stroke-width", "1.8");
      icon.append(path);
      remove.append(icon);
      li.append(date, remove);
      blockedDateList.append(li);
    });
  }

  const weddingDate = (value) => localDate(value).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  const galleryBucket = "wedding-gallery";
  const supportedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  const photoPathFor = (weddingId, file) => {
    const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    return `${weddingId}/${crypto.randomUUID()}.${extension}`;
  };

  function publicPhotoUrl(path) {
    return client.storage.from(galleryBucket).getPublicUrl(path).data.publicUrl;
  }

  async function saveWeddingPhotos(weddingId, files, startingPosition = 0) {
    const addedPaths = [];
    const photoRows = [];
    for (const [index, file] of [...files].entries()) {
      if (!supportedImageTypes.has(file.type) || file.size > 15 * 1024 * 1024) {
        if (addedPaths.length) await client.storage.from(galleryBucket).remove(addedPaths);
        return { error: "Choose JPG, PNG, or WebP photos no larger than 15 MB each." };
      }
      let resized;
      try {
        resized = await resizeGalleryImage(file);
      } catch {
        if (addedPaths.length) await client.storage.from(galleryBucket).remove(addedPaths);
        return { error: "A photo could not be resized in this browser. Try a JPEG, PNG, or WebP image." };
      }
      const path = photoPathFor(weddingId, resized);
      const { error: uploadError } = await client.storage.from(galleryBucket).upload(path, resized, {
        cacheControl: "31536000", contentType: "image/jpeg", upsert: false
      });
      if (uploadError) {
        if (addedPaths.length) await client.storage.from(galleryBucket).remove(addedPaths);
        return { error: "A photo could not be uploaded. Check the bucket migration and try again." };
      }
      addedPaths.push(path);
      photoRows.push({ wedding_id: weddingId, storage_path: path, position: startingPosition + index });
    }
    const { error } = await client.from("wedding_gallery_photos").insert(photoRows);
    if (error) {
      if (addedPaths.length) await client.storage.from(galleryBucket).remove(addedPaths);
      return { error: "Photos uploaded, but the gallery could not be saved. Please try again." };
    }
    return { error: null };
  }

  async function resizeGalleryImage(file) {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    try {
      const scale = Math.min(1, 2000 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("Canvas is unavailable");
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error("JPEG encoding failed")), "image/jpeg", 0.82);
      });
      return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg", lastModified: file.lastModified });
    } finally {
      bitmap.close();
    }
  }

  function renderWeddingGalleries() {
    weddingGalleryList.replaceChildren();
    emptyWeddings.classList.toggle("hidden", weddings.length > 0);
    weddings.forEach((wedding) => {
      const card = make("article", "wedding-gallery-card");
      const heading = make("div", "wedding-gallery-heading");
      const title = make("h3", "", wedding.couple_names);
      const meta = make("p", "", `${categoryLabel(wedding.category || "wedding")} · ${weddingDate(wedding.event_date)}${wedding.location ? ` · ${wedding.location}` : ""}`);
      const categorySelect = document.createElement("select");
      categorySelect.className = "gallery-category";
      categorySelect.dataset.weddingId = wedding.id;
      categorySelect.setAttribute("aria-label", `Category for ${wedding.couple_names}`);
      galleryCategories.forEach((category) => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = categoryLabel(category);
        option.selected = category === wedding.category;
        categorySelect.append(option);
      });
      heading.append(title, meta, categorySelect);

      const publishLabel = document.createElement("label");
      publishLabel.className = "gallery-publish-toggle";
      const publishInput = document.createElement("input");
      publishInput.type = "checkbox";
      publishInput.className = "gallery-publish";
      publishInput.checked = Boolean(wedding.is_published);
      publishInput.disabled = !(weddingPhotos.get(wedding.id) || []).length;
      publishInput.setAttribute("aria-label", `Publish ${wedding.couple_names} on the public portfolio`);
      publishInput.dataset.weddingId = wedding.id;
      publishLabel.append(publishInput, document.createTextNode(" Published"));

      const removeWedding = make("button", "button button-danger gallery-delete-wedding", "Delete wedding");
      removeWedding.type = "button";
      removeWedding.dataset.weddingId = wedding.id;
      const top = make("div", "wedding-gallery-top");
      top.append(heading, publishLabel, removeWedding);

      const photos = make("div", "wedding-photo-list");
      (weddingPhotos.get(wedding.id) || []).forEach((photo) => {
        const tile = make("div", "wedding-photo-tile");
        const image = document.createElement("img");
        image.src = publicPhotoUrl(photo.storage_path);
        image.alt = `${wedding.couple_names} wedding portfolio photo`;
        image.loading = "lazy";
        const deletePhoto = make("button", "wedding-photo-delete", "×");
        deletePhoto.type = "button";
        deletePhoto.title = "Remove photo";
        deletePhoto.setAttribute("aria-label", `Remove a photo from ${wedding.couple_names}`);
        deletePhoto.dataset.photoId = photo.id;
        deletePhoto.dataset.storagePath = photo.storage_path;
        tile.append(image, deletePhoto);
        photos.append(tile);
      });

      const uploadForm = make("form", "wedding-photo-upload");
      uploadForm.dataset.weddingId = wedding.id;
      const uploadLabel = document.createElement("label");
      uploadLabel.textContent = "Add photos";
      const uploadInput = document.createElement("input");
      uploadInput.type = "file";
      uploadInput.name = "photos";
      uploadInput.accept = "image/jpeg,image/png,image/webp";
      uploadInput.multiple = true;
      uploadInput.required = true;
      uploadLabel.append(uploadInput);
      const uploadButton = make("button", "button", "Upload");
      uploadButton.type = "submit";
      uploadForm.append(uploadLabel, uploadButton);

      card.append(top, photos, uploadForm);
      weddingGalleryList.append(card);
    });
  }

  async function loadWeddingGalleries() {
    galleryMessage.textContent = "Loading galleries…";
    const { data, error } = await client.from("weddings")
      .select("id, couple_names, event_date, location, category, is_published")
      .order("event_date", { ascending: false });
    if (error) {
      galleryMessage.textContent = "Couldn’t load galleries. Run migration 014 in Supabase.";
      return;
    }
    weddings = data || [];
    weddingPhotos = new Map(weddings.map((wedding) => [wedding.id, []]));
    if (weddings.length) {
      const { data: photoRows, error: photosError } = await client.from("wedding_gallery_photos")
        .select("id, wedding_id, storage_path, position")
        .in("wedding_id", weddings.map((wedding) => wedding.id))
        .order("position", { ascending: true }).order("created_at", { ascending: true });
      if (photosError) {
        galleryMessage.textContent = "Couldn’t load gallery photos. Check migration 014.";
        return;
      }
      (photoRows || []).forEach((photo) => weddingPhotos.get(photo.wedding_id)?.push(photo));
    }
    galleryMessage.textContent = "";
    renderWeddingGalleries();
  }

  weddingForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const fields = new FormData(weddingForm);
    const files = fields.getAll("photos").filter((file) => file instanceof File && file.size > 0);
    if (!files.length) {
      galleryMessage.textContent = "Choose at least one photo for the wedding gallery.";
      return;
    }
    const submit = weddingForm.querySelector("button[type='submit']");
    submit.disabled = true;
    galleryMessage.textContent = "Creating wedding gallery and uploading photos…";
    const { data: wedding, error } = await client.from("weddings").insert({
      couple_names: fields.get("couple_names").trim(),
      event_date: fields.get("event_date"),
      location: fields.get("location").trim(),
      category: fields.get("category"),
      is_published: false
    }).select("id").single();
    if (error) {
      submit.disabled = false;
      galleryMessage.textContent = "Couldn’t create the wedding. Check your admin access and migration 014.";
      return;
    }
    const uploadResult = await saveWeddingPhotos(wedding.id, files);
    if (uploadResult.error) {
      await client.from("weddings").delete().eq("id", wedding.id);
      submit.disabled = false;
      galleryMessage.textContent = uploadResult.error;
      return;
    }
    const { error: publishError } = await client.from("weddings").update({ is_published: true }).eq("id", wedding.id);
    submit.disabled = false;
    const resultMessage = publishError
      ? "Photos are uploaded, but the wedding could not be published. Toggle Published below to try again."
      : "Wedding added and published to the portfolio.";
    if (!publishError) weddingForm.reset();
    await loadWeddingGalleries();
    galleryMessage.textContent = resultMessage;
  });

  weddingGalleryList.addEventListener("submit", async (event) => {
    const uploadForm = event.target.closest(".wedding-photo-upload");
    if (!uploadForm) return;
    event.preventDefault();
    const input = uploadForm.elements.photos;
    const files = [...input.files];
    if (!files.length) return;
    const weddingId = uploadForm.dataset.weddingId;
    const button = uploadForm.querySelector("button[type='submit']");
    const currentPhotos = weddingPhotos.get(weddingId) || [];
    button.disabled = true;
    galleryMessage.textContent = "Uploading gallery photos…";
    const result = await saveWeddingPhotos(weddingId, files, currentPhotos.length);
    button.disabled = false;
    if (!result.error) await loadWeddingGalleries();
    galleryMessage.textContent = result.error || "Photos added to the wedding gallery.";
  });

  weddingGalleryList.addEventListener("change", async (event) => {
    const categorySelect = event.target.closest(".gallery-category");
    if (categorySelect) {
      const wedding = weddings.find((item) => item.id === categorySelect.dataset.weddingId);
      if (!wedding) return;
      const previous = wedding.category || "wedding";
      categorySelect.disabled = true;
      const { error } = await client.from("weddings").update({ category: categorySelect.value }).eq("id", wedding.id);
      categorySelect.disabled = false;
      if (error) {
        categorySelect.value = previous;
        galleryMessage.textContent = "Category couldn’t be saved.";
        return;
      }
      wedding.category = categorySelect.value;
      galleryMessage.textContent = "Gallery category saved.";
      renderWeddingGalleries();
      return;
    }
    const checkbox = event.target.closest(".gallery-publish");
    if (!checkbox) return;
    const wedding = weddings.find((item) => item.id === checkbox.dataset.weddingId);
    if (!wedding) return;
    checkbox.disabled = true;
    const { error } = await client.from("weddings").update({ is_published: checkbox.checked }).eq("id", wedding.id);
    checkbox.disabled = false;
    if (error) {
      checkbox.checked = !checkbox.checked;
      galleryMessage.textContent = "Publish setting couldn’t be saved.";
      return;
    }
    wedding.is_published = checkbox.checked;
    galleryMessage.textContent = checkbox.checked ? "Gallery published." : "Gallery unpublished.";
  });

  weddingGalleryList.addEventListener("click", async (event) => {
    const photoButton = event.target.closest(".wedding-photo-delete");
    if (photoButton) {
      const photoId = photoButton.dataset.photoId;
      const storagePath = photoButton.dataset.storagePath;
      if (!window.confirm("Remove this photo from the gallery?")) return;
      photoButton.disabled = true;
      const { error: storageError } = await client.storage.from(galleryBucket).remove([storagePath]);
      if (storageError) {
        photoButton.disabled = false;
        galleryMessage.textContent = "Photo couldn’t be removed from storage.";
        return;
      }
      const { error } = await client.from("wedding_gallery_photos").delete().eq("id", photoId);
      if (error) {
        galleryMessage.textContent = "Photo file removed, but its gallery record couldn’t be deleted.";
        return;
      }
      await loadWeddingGalleries();
      galleryMessage.textContent = "Photo removed.";
      return;
    }
    const deleteButton = event.target.closest(".gallery-delete-wedding");
    if (!deleteButton) return;
    const wedding = weddings.find((item) => item.id === deleteButton.dataset.weddingId);
    if (!wedding || !window.confirm(`Delete ${wedding.couple_names} and all its portfolio photos?`)) return;
    deleteButton.disabled = true;
    const photos = weddingPhotos.get(wedding.id) || [];
    if (photos.length) {
      const { error: storageError } = await client.storage.from(galleryBucket).remove(photos.map((photo) => photo.storage_path));
      if (storageError) {
        deleteButton.disabled = false;
        galleryMessage.textContent = "Wedding photos couldn’t be removed from storage.";
        return;
      }
    }
    const { error } = await client.from("weddings").delete().eq("id", wedding.id);
    if (error) {
      deleteButton.disabled = false;
      galleryMessage.textContent = "Wedding files were removed, but the gallery record couldn’t be deleted.";
      return;
    }
    await loadWeddingGalleries();
    galleryMessage.textContent = "Wedding and gallery deleted.";
  });

  async function loadBlockedDates() {
    const { data, error } = await client.from("blocked_dates")
      .select("id, blocked_date").order("blocked_date", { ascending: true });
    if (error) {
      dashboardMessage.textContent = "Couldn’t load unavailable dates. Check the blocked-dates migration.";
      return;
    }
    blockedDates = data || [];
    renderBlockedDates();
  }

  async function loadBookings() {
    dashboardMessage.textContent = "Loading bookings…";
    await loadAddonSettings();
    const allBookings = [];
    for (let start = 0; ; start += 1000) {
      const { data, error } = await client.from("bookings")
        .select("id, created_at, package, name, phone, email, event, event_date, event_time, location, payment, status, notes, addons, booking_code, total_price, deposit_paid, paid_at, balance_due, delivery_url")
        .order("event_date", { ascending: true }).order("id", { ascending: true }).range(start, start + 999);
      if (error) {
        dashboardMessage.textContent = "Couldn’t load bookings. Check the Supabase setup and admin access.";
        return;
      }
      allBookings.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    bookings = allBookings;
    dashboardMessage.textContent = "";
    renderStats();
    renderTable();
    renderCalendar();
    await loadBlockedDates();
    await loadWeddingGalleries();
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!client) {
      loginMessage.textContent = "Add your Supabase project URL and anon key to config.js first.";
      return;
    }
    const submitButton = loginForm.querySelector("button[type='submit']");
    submitButton.disabled = true;
    loginMessage.textContent = "Signing in…";
    const fields = new FormData(loginForm);
    const { data, error } = await client.auth.signInWithPassword({ email: fields.get("email"), password: fields.get("password") });
    submitButton.disabled = false;
    if (error) {
      loginMessage.textContent = "Sign-in failed. Check the email and password.";
      return;
    }
    loginMessage.textContent = "";
    try {
      const ok = await AdminSecurity.mfaGate(client, loginPanel);
      if (!ok) {
        await client.auth.signOut();
        setSignedIn(false);
        return;
      }
      setSignedIn(true);
      AdminSecurity.startIdleTimer(client);
      await loadBookings();
    } catch (mfaError) {
      console.error("Admin MFA failed:", mfaError);
      await client.auth.signOut();
      location.reload();
    }
  });

  signOutButton.addEventListener("click", async () => {
    if (!client) return;
    AdminSecurity.stopIdleTimer();
    const { error } = await client.auth.signOut();
    if (error) dashboardMessage.textContent = "Couldn’t sign out. Please try again.";
    else location.reload();
  });

  bookingsBody.addEventListener("change", async (event) => {
    if (!event.target.matches(".status-select")) return;
    const row = event.target.closest(".booking-card");
    const bookingId = row.dataset.bookingId;
    const previous = bookings.find((item) => item.id === bookingId)?.status;
    const nextStatus = event.target.value;
    event.target.disabled = true;
    const { error } = await client.from("bookings").update({ status: nextStatus }).eq("id", bookingId);
    event.target.disabled = false;
    if (error) {
      event.target.value = previous;
      dashboardMessage.textContent = "Status couldn’t be saved.";
      return;
    }
    const booking = bookings.find((item) => item.id === bookingId);
    booking.status = nextStatus;
    row.dataset.status = nextStatus;
    dashboardMessage.textContent = "Status saved.";
    renderStats();
    renderCalendar();
    applyBookingFilters();
  });

  bookingsBody.addEventListener("click", async (event) => {
    const icsButton = event.target.closest(".download-ics");
    if (icsButton) {
      const booking = bookings.find((item) => item.id === icsButton.dataset.bookingId);
      if (booking) downloadIcs(booking);
      return;
    }
    const invoiceButton = event.target.closest(".print-invoice");
    if (invoiceButton) {
      const booking = bookings.find((item) => item.id === invoiceButton.dataset.bookingId);
      if (booking) printInvoice(booking);
      return;
    }
    const deliveryButton = event.target.closest(".save-delivery");
    if (deliveryButton) {
      const row = deliveryButton.closest(".booking-card");
      const booking = bookings.find((item) => item.id === row.dataset.bookingId);
      const rawUrl = row.querySelector(".delivery-url").value.trim();
      const deliveryUrl = rawUrl || null;
      if (deliveryUrl && !AdminSecurity.isDeliveryUrl(deliveryUrl)) {
        dashboardMessage.textContent = "Enter a valid HTTPS Google Drive link.";
        return;
      }
      deliveryButton.disabled = true;
      const { error } = await client.from("bookings").update({ delivery_url: deliveryUrl }).eq("id", booking.id);
      deliveryButton.disabled = false;
      if (error) {
        dashboardMessage.textContent = "Gallery link couldn’t be saved.";
        return;
      }
      booking.delivery_url = deliveryUrl;
      dashboardMessage.textContent = "Gallery link saved.";
      renderTable();
      renderStats();
      return;
    }
    const paymentButton = event.target.closest(".save-payment");
    if (paymentButton) {
      const row = paymentButton.closest(".booking-card");
      const booking = bookings.find((item) => item.id === row.dataset.bookingId);
      const depositPaid = row.querySelector(".deposit-paid").checked;
      paymentButton.disabled = true;
      const { data, error } = await client.from("bookings")
        .update({ deposit_paid: depositPaid })
        .eq("id", booking.id).select("deposit_paid, balance_due, paid_at").single();
      paymentButton.disabled = false;
      if (error) {
        dashboardMessage.textContent = "Payment status couldn't be saved.";
        return;
      }
      Object.assign(booking, data);
      dashboardMessage.textContent = "Payment status saved.";
      renderTable();
      renderStats();
      return;
    }
    const notesButton = event.target.closest(".save-notes");
    if (notesButton) {
      const row = notesButton.closest(".booking-card");
      const booking = bookings.find((item) => item.id === row.dataset.bookingId);
      const notes = row.querySelector(".booking-notes").value;
      notesButton.disabled = true;
      const { error } = await client.from("bookings").update({ notes }).eq("id", booking.id);
      notesButton.disabled = false;
      if (error) {
        dashboardMessage.textContent = "Notes couldn’t be saved.";
        return;
      }
      booking.notes = notes;
      dashboardMessage.textContent = "Notes saved.";
      return;
    }
    const button = event.target.closest(".delete-booking");
    if (!button) return;
    const row = button.closest(".booking-card");
    const booking = bookings.find((item) => item.id === row.dataset.bookingId);
    if (!booking || !window.confirm(`Delete the booking for ${booking.name}? This cannot be undone.`)) return;
    button.disabled = true;
    const { error } = await client.from("bookings").delete().eq("id", booking.id);
    if (error) {
      button.disabled = false;
      dashboardMessage.textContent = "Booking couldn’t be deleted.";
      return;
    }
    bookings = bookings.filter((item) => item.id !== booking.id);
    dashboardMessage.textContent = "Booking deleted.";
    renderStats();
    renderTable();
    renderCalendar();
  });

  document.getElementById("bookingsTab").addEventListener("click", () => setTab("bookings"));
  document.getElementById("calendarTab").addEventListener("click", () => setTab("calendar"));
  document.getElementById("galleryTab").addEventListener("click", () => setTab("gallery"));
  document.getElementById("revenueTab").addEventListener("click", () => setTab("revenue"));
  document.getElementById("clientsTab").addEventListener("click", () => setTab("clients"));
  document.getElementById("settingsTab").addEventListener("click", () => setTab("settings"));
  nextWeekList.addEventListener("click", (event) => {
    const chip = event.target.closest(".next-week-chip");
    if (!chip) return;
    setTab("bookings");
    window.requestAnimationFrame(() => {
      const card = [...bookingsBody.querySelectorAll(".booking-card")].find((item) => item.dataset.bookingId === chip.dataset.bookingId);
      if (!card) return;
      card.querySelector(".booking-extra").open = true;
      card.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
  clientSearch.addEventListener("input", renderClients);
  addonAdminList.addEventListener("submit", async (event) => {
    const form = event.target.closest(".addon-admin-row");
    if (!form) return;
    event.preventDefault();
    const code = form.dataset.code;
    const original = addons.find((item) => item.code === code);
    if (!original) return;
    const fields = new FormData(form);
    const update = {
      label: String(fields.get("label") || "").trim(),
      price: Number(fields.get("price")),
      active: form.elements.active.checked,
      sort: Number(fields.get("sort"))
    };
    if (!update.label || !Number.isFinite(update.price) || update.price < 0 || !Number.isInteger(update.sort)) {
      addonAdminMessage.textContent = "Enter a label, a non-negative price, and a whole-number sort order.";
      return;
    }
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    const { error } = await client.from("addons").update(update).eq("code", code);
    button.disabled = false;
    if (error) {
      addonAdminMessage.textContent = "Add-on couldn’t be saved.";
      return;
    }
    Object.assign(original, update);
    addonAdminMessage.textContent = "Add-on saved.";
    await loadAddonSettings();
    renderTable();
    renderStats();
  });
  bookingFilters.addEventListener("click", (event) => {
    const pill = event.target.closest(".filter-pill");
    if (!pill) return;
    activeBookingFilter = pill.dataset.filter;
    bookingFilters.querySelectorAll(".filter-pill").forEach((button) => {
      const active = button === pill;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    applyBookingFilters();
  });
  bookingSearch.addEventListener("input", applyBookingFilters);
  document.getElementById("previousMonth").addEventListener("click", () => { month = new Date(month.getFullYear(), month.getMonth() - 1, 1); renderCalendar(); });
  document.getElementById("nextMonth").addEventListener("click", () => { month = new Date(month.getFullYear(), month.getMonth() + 1, 1); renderCalendar(); });
  calendarGrid.addEventListener("click", (event) => {
    const dayButton = event.target.closest("button[data-date]");
    if (!dayButton) return;
    selectedDay = dayButton.dataset.date;
    const date = localDate(selectedDay);
    if (date.getMonth() !== month.getMonth()) month = new Date(date.getFullYear(), date.getMonth(), 1);
    renderCalendar();
  });
  selectedDayPanel.addEventListener("click", async (event) => {
    const button = event.target.closest("button.quick-status");
    if (!button) return;
    button.disabled = true;
    const { error } = await client.from("bookings").update({ status: button.dataset.status }).eq("id", button.dataset.bookingId);
    if (error) {
      button.disabled = false;
      dashboardMessage.textContent = "Booking action couldn’t be saved.";
      return;
    }
    const booking = bookings.find((item) => item.id === button.dataset.bookingId);
    booking.status = button.dataset.status;
    dashboardMessage.textContent = `Booking marked ${booking.status}.`;
    renderStats();
    renderTable();
    renderCalendar();
  });

  blockedDateForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = blockedDateForm.elements.blocked_date;
    const button = blockedDateForm.querySelector("button[type='submit']");
    button.disabled = true;
    const { error } = await client.from("blocked_dates").insert({ blocked_date: input.value });
    button.disabled = false;
    if (error) {
      dashboardMessage.textContent = error.code === "23505" ? "That date is already blocked." : "Couldn’t block that date.";
      return;
    }
    dashboardMessage.textContent = "Date blocked.";
    blockedDateForm.reset();
    await loadBlockedDates();
  });

  blockedDateList.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-blocked-date-id]");
    if (!button) return;
    button.disabled = true;
    const { error } = await client.from("blocked_dates").delete().eq("id", button.dataset.blockedDateId);
    if (error) {
      button.disabled = false;
      dashboardMessage.textContent = "Couldn’t remove that unavailable date.";
      return;
    }
    dashboardMessage.textContent = "Date removed.";
    await loadBlockedDates();
  });

  document.getElementById("exportCsv").addEventListener("click", () => {
    const columns = [
      ["id", "ID"], ["created_at", "Created at"], ["package", "Package"], ["name", "Name"],
      ["phone", "Phone"], ["email", "Email"], ["event", "Event"], ["event_date", "Event date"],
      ["event_time", "Event time"], ["location", "Location"], ["payment", "Payment method"],
      ["status", "Status"], ["notes", "Admin notes"], ["total_price", "Total price"],
      ["addons", "Add-ons"], ["booking_code", "Booking code"], ["deposit_paid", "Paid"], ["paid_at", "Paid at"], ["balance_due", "Balance due"],
      ["delivery_url", "Gallery delivery link"]
    ];
    const csvCell = (value) => {
      let text = value == null ? "" : String(value);
      if (/^[\u0000-\u0020]*[=+@-]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const rows = [columns.map(([, label]) => csvCell(label)).join(",")];
    bookings.forEach((booking) => rows.push(columns.map(([key]) => csvCell(booking[key])).join(",")));
    const blob = new Blob(["\uFEFF", rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dan-visuals-bookings-${dateKey(new Date())}.csv`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });

  function setTab(active) {
    ["bookings", "calendar", "gallery", "revenue", "clients", "settings"].forEach((view) => {
      const selected = active === view;
      const button = document.getElementById(`${view}Tab`);
      button.classList.toggle("is-active", selected);
      if (selected) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
      document.getElementById(`${view}View`).classList.toggle("hidden", !selected);
    });
    if (active === "gallery" && client) loadWeddingGalleries();
    if (active === "revenue") renderRevenue();
    if (active === "clients") renderClients();
    if (active === "settings" && client) loadAddonSettings(true);
  }

  if (!configured) loginMessage.textContent = "Add your Supabase project URL and anon key to config.js first.";
  if (AdminSecurity.consumeIdleNotice()) loginMessage.textContent = "Signed out for security.";
  if (client) {
    client.auth.getSession().then(async ({ data, error }) => {
      if (error || !data.session) {
        setSignedIn(false);
        return;
      }
      try {
        const ok = await AdminSecurity.mfaGate(client, loginPanel);
        if (!ok) {
          await client.auth.signOut();
          setSignedIn(false);
          return;
        }
        setSignedIn(true);
        AdminSecurity.startIdleTimer(client);
        await loadBookings();
      } catch (mfaError) {
        console.error("Admin MFA failed:", mfaError);
        await client.auth.signOut();
        location.reload();
      }
    });
    client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        AdminSecurity.stopIdleTimer();
        bookings = [];
        window.setTimeout(() => location.reload(), 0);
      }
    });
  }
})();
