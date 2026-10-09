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
  const statusOptions = ["new", "confirmed", "completed", "cancelled"];
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const client = configured
    ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
    : null;
  let bookings = [];
  let blockedDates = [];
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
  const isDriveUrl = (value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.hostname === "drive.google.com";
    } catch { return false; }
  };
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
      const deleteButton = make("button", "button button-danger delete-booking", "Delete");
      deleteButton.type = "button";
      actions.append(deleteButton);
      side.append(actions);

      const details = make("details", "booking-extra");
      details.open = openDetails.has(String(booking.id));
      const summary = make("summary", "");
      const balance = Number(booking.balance_due);
      const depositAmountValue = Number(booking.deposit_amount || 0);
      const paymentBadge = booking.total_price == null || booking.balance_due == null || !booking.deposit_paid
        ? { cls: "is-pending", label: "Deposit pending" }
        : balance <= 0 ? { cls: "is-paid", label: "Paid in full" }
          : { cls: "is-due", label: "Balance due" };
      summary.append(make("span", "pay-summary", `${formatPhp(booking.total_price)} · Deposit ${formatPhp(depositAmountValue)} ${booking.deposit_paid ? "paid" : "unpaid"} · Balance ${formatPhp(booking.balance_due)}`));
      summary.append(make("span", `pay-badge ${paymentBadge.cls}`, paymentBadge.label));
      details.append(summary);
      const grid = make("div", "extra-grid");

      const payment = make("div", "extra-group");
      payment.append(make("h4", "", "Payment"));
      payment.append(make("p", "", `Total price: ${formatPhp(booking.total_price)}`));
      const depositAmount = document.createElement("input");
      depositAmount.type = "number";
      depositAmount.min = "0";
      depositAmount.step = "0.01";
      depositAmount.className = "deposit-amount";
      depositAmount.value = booking.deposit_amount ?? 0;
      depositAmount.setAttribute("aria-label", `Deposit amount for ${booking.name || "booking"}`);
      payment.append(depositAmount);
      const paidLabel = document.createElement("label");
      paidLabel.className = "paid-toggle";
      const paid = document.createElement("input");
      paid.type = "checkbox";
      paid.className = "deposit-paid paid-toggle";
      paid.checked = Boolean(booking.deposit_paid);
      paidLabel.append(paid, document.createTextNode(" Paid"));
      const savePayment = document.createElement("button");
      savePayment.type = "button";
      savePayment.className = "button save-payment";
      savePayment.textContent = "Save";
      payment.append(paidLabel, savePayment);
      const balanceBox = make("div", "balance-box");
      balanceBox.append(make("span", "", "Balance due"), make("strong", "", formatPhp(booking.balance_due)));
      payment.append(balanceBox);
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
      if (booking.delivery_url && isDriveUrl(booking.delivery_url)) {
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
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove blocked date ${formatDate(item.blocked_date)}`);
      remove.dataset.blockedDateId = item.id;
      li.append(date, remove);
      blockedDateList.append(li);
    });
  }

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
    const allBookings = [];
    for (let start = 0; ; start += 1000) {
      const { data, error } = await client.from("bookings")
        .select("id, created_at, package, name, phone, email, event, event_date, event_time, location, payment, status, notes, total_price, deposit_amount, deposit_paid, balance_due, delivery_url")
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
    const { error } = await client.auth.signInWithPassword({ email: fields.get("email"), password: fields.get("password") });
    submitButton.disabled = false;
    loginMessage.textContent = error ? "Sign-in failed. Check the email and password." : "";
  });

  signOutButton.addEventListener("click", async () => {
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) dashboardMessage.textContent = "Couldn’t sign out. Please try again.";
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
    const deliveryButton = event.target.closest(".save-delivery");
    if (deliveryButton) {
      const row = deliveryButton.closest(".booking-card");
      const booking = bookings.find((item) => item.id === row.dataset.bookingId);
      const rawUrl = row.querySelector(".delivery-url").value.trim();
      const deliveryUrl = rawUrl || null;
      if (deliveryUrl && !isDriveUrl(deliveryUrl)) {
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
      return;
    }
    const paymentButton = event.target.closest(".save-payment");
    if (paymentButton) {
      const row = paymentButton.closest(".booking-card");
      const booking = bookings.find((item) => item.id === row.dataset.bookingId);
      const depositAmount = Number(row.querySelector(".deposit-amount").value);
      const depositPaid = row.querySelector(".deposit-paid").checked;
      if (!Number.isFinite(depositAmount) || depositAmount < 0) {
        dashboardMessage.textContent = "Enter a valid non-negative deposit amount.";
        return;
      }
      paymentButton.disabled = true;
      const { data, error } = await client.from("bookings")
        .update({ deposit_amount: depositAmount, deposit_paid: depositPaid })
        .eq("id", booking.id).select("deposit_amount, deposit_paid, balance_due").single();
      paymentButton.disabled = false;
      if (error) {
        dashboardMessage.textContent = "Payment details couldn’t be saved.";
        return;
      }
      Object.assign(booking, data);
      dashboardMessage.textContent = "Payment details saved.";
      renderTable();
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
      ["deposit_amount", "Deposit amount"], ["deposit_paid", "Deposit paid"], ["balance_due", "Balance due"],
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
    const bookingsActive = active === "bookings";
    document.getElementById("bookingsTab").classList.toggle("is-active", bookingsActive);
    document.getElementById("bookingsTab").setAttribute("aria-selected", String(bookingsActive));
    document.getElementById("calendarTab").classList.toggle("is-active", !bookingsActive);
    document.getElementById("calendarTab").setAttribute("aria-selected", String(!bookingsActive));
    document.getElementById("bookingsView").classList.toggle("hidden", !bookingsActive);
    document.getElementById("calendarView").classList.toggle("hidden", bookingsActive);
  }

  if (!configured) loginMessage.textContent = "Add your Supabase project URL and anon key to config.js first.";
  if (client) {
    client.auth.getSession().then(({ data }) => {
      const isSignedIn = Boolean(data.session);
      setSignedIn(isSignedIn);
      if (isSignedIn) loadBookings();
    });
    client.auth.onAuthStateChange((event, session) => {
      const isSignedIn = Boolean(session);
      setSignedIn(isSignedIn);
      if (event === "SIGNED_IN" && isSignedIn) loadBookings();
      if (event === "SIGNED_OUT") bookings = [];
    });
  }
})();
