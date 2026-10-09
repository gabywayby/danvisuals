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
  const calendarGrid = document.getElementById("calendarGrid");
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
  let month = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const localDate = (value) => {
    const [year, monthNumber, day] = value.split("-").map(Number);
    return new Date(year, monthNumber - 1, day);
  };
  const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const formatDate = (value) => localDate(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const formatPhp = (value) => value == null ? "—" : new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 2 }).format(Number(value));
  const appendTextCell = (row, value, className = "") => {
    const cell = document.createElement("td");
    if (className) cell.className = className;
    cell.textContent = value == null ? "" : String(value);
    row.append(cell);
    return cell;
  };

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
    bookingsBody.replaceChildren();
    emptyBookings.classList.toggle("hidden", bookings.length > 0);
    bookings.forEach((booking) => {
      const row = document.createElement("tr");
      row.dataset.bookingId = booking.id;
      appendTextCell(row, formatDate(booking.event_date));
      const clientCell = appendTextCell(row, booking.name);
      const email = document.createElement("a");
      email.href = `mailto:${encodeURIComponent(booking.email || "")}`;
      email.textContent = booking.email || "";
      email.className = "subtext";
      clientCell.append(email);
      appendTextCell(row, booking.package);
      appendTextCell(row, formatPhp(booking.total_price));
      const depositCell = document.createElement("td");
      const depositAmount = document.createElement("input");
      depositAmount.type = "number";
      depositAmount.min = "0";
      depositAmount.step = "0.01";
      depositAmount.className = "deposit-amount";
      depositAmount.value = booking.deposit_amount ?? 0;
      depositAmount.setAttribute("aria-label", `Deposit amount for ${booking.name}`);
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
      depositCell.append(depositAmount, paidLabel, savePayment);
      row.append(depositCell);
      appendTextCell(row, formatPhp(booking.balance_due));
      const eventCell = appendTextCell(row, booking.event);
      const time = document.createElement("span");
      time.className = "subtext";
      time.textContent = booking.event_time || "";
      eventCell.append(time);
      const contactCell = appendTextCell(row, booking.phone);
      const location = document.createElement("span");
      location.className = "subtext";
      location.textContent = booking.location || "";
      contactCell.append(location);

      const notesCell = document.createElement("td");
      const notesInput = document.createElement("textarea");
      notesInput.className = "booking-notes";
      notesInput.setAttribute("aria-label", `Admin notes for ${booking.name}`);
      notesInput.value = booking.notes || "";
      const saveNotes = document.createElement("button");
      saveNotes.type = "button";
      saveNotes.className = "button save-notes";
      saveNotes.textContent = "Save notes";
      notesCell.append(notesInput, saveNotes);
      row.append(notesCell);

      const statusCell = document.createElement("td");
      const select = document.createElement("select");
      select.className = "status-select";
      select.setAttribute("aria-label", `Status for ${booking.name}`);
      statusOptions.forEach((status) => {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = status[0].toUpperCase() + status.slice(1);
        select.append(option);
      });
      select.value = booking.status;
      statusCell.append(select);
      row.append(statusCell);

      const actionsCell = document.createElement("td");
      const actions = document.createElement("div");
      actions.className = "row-actions";
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "button button-danger delete-booking";
      deleteButton.textContent = "Delete";
      actions.append(deleteButton);
      actionsCell.append(actions);
      row.append(actionsCell);
      bookingsBody.append(row);
    });
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
      const day = document.createElement("div");
      day.className = "calendar-day";
      if (date.getMonth() !== month.getMonth()) day.classList.add("is-outside");
      if (key === today) day.classList.add("is-today");
      const number = document.createElement("span");
      number.className = "day-number";
      number.textContent = date.getDate();
      day.append(number);
      bookings.filter((booking) => booking.event_date === key).forEach((booking) => {
        const chip = document.createElement("span");
        chip.className = `booking-chip status-${statusOptions.includes(booking.status) ? booking.status : "new"}`;
        chip.textContent = booking.name;
        chip.title = `${booking.name} · ${booking.event}`;
        day.append(chip);
      });
      calendarGrid.append(day);
    }
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
    const { data, error } = await client.from("bookings")
      .select("id, created_at, package, name, phone, email, event, event_date, event_time, location, payment, status, notes, total_price, deposit_amount, deposit_paid, balance_due")
      .order("event_date", { ascending: true });
    if (error) {
      dashboardMessage.textContent = "Couldn’t load bookings. Check the Supabase setup and admin access.";
      return;
    }
    bookings = data || [];
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
    const row = event.target.closest("tr");
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
    dashboardMessage.textContent = "Status saved.";
    renderStats();
    renderCalendar();
  });

  bookingsBody.addEventListener("click", async (event) => {
    const paymentButton = event.target.closest(".save-payment");
    if (paymentButton) {
      const row = paymentButton.closest("tr");
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
      const row = notesButton.closest("tr");
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
    const row = button.closest("tr");
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
  document.getElementById("previousMonth").addEventListener("click", () => { month = new Date(month.getFullYear(), month.getMonth() - 1, 1); renderCalendar(); });
  document.getElementById("nextMonth").addEventListener("click", () => { month = new Date(month.getFullYear(), month.getMonth() + 1, 1); renderCalendar(); });

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
