document.getElementById("year").textContent = new Date().getFullYear();

const menuButton = document.querySelector(".menu-toggle");
const menu = document.getElementById("site-navigation");
menuButton.addEventListener("click", () => {
  const isOpen = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!isOpen));
  menuButton.setAttribute("aria-label", isOpen ? "Open navigation" : "Close navigation");
  menu.classList.toggle("is-open", !isOpen);
});
menu.addEventListener("click", (event) => {
  if (event.target.closest("a")) {
    menu.classList.remove("is-open");
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "Open navigation");
  }
});

// Hero slideshow: add the remaining photos to images/ using these filenames.
(function () {
  const slides = document.querySelectorAll(".hero-slide");
  if (slides.length < 2) return;
  const photos = ["images/hero.jpg", "images/hero-2.jpg", "images/hero-3.jpg", "images/hero-4.jpg"];
  photos.slice(1).forEach((src) => { const image = new Image(); image.src = src; });
  let activeLayer = slides[0];
  let inactiveLayer = slides[1];
  activeLayer.style.backgroundImage = `url("${photos[0]}")`;
  let current = 0;
  window.setInterval(() => {
    const next = (current + 1) % photos.length;
    inactiveLayer.style.backgroundImage = `url("${photos[next]}")`;
    inactiveLayer.classList.add("is-active");
    activeLayer.classList.remove("is-active");
    [activeLayer, inactiveLayer] = [inactiveLayer, activeLayer];
    current = next;
  }, 6000);
})();

// Sessions & Events slider
(function () {
  const slider = document.getElementById("sessionsSlider");
  if (!slider) return;
  const track = slider.querySelector(".slider-track");
  const prev = document.getElementById("sliderPrev");
  const next = document.getElementById("sliderNext");
  const dotsWrap = document.getElementById("sliderDots");
  const controls = slider.querySelector(".slider-controls");
  let pages = 1;

  const stepSize = () => {
    const card = track.querySelector(".package");
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return card.getBoundingClientRect().width + gap;
  };
  const maxScroll = () => track.scrollWidth - track.clientWidth;

  function build() {
    pages = Math.max(1, Math.round(maxScroll() / stepSize()) + 1);
    dotsWrap.innerHTML = "";
    for (let i = 0; i < pages; i++) {
      const d = document.createElement("button");
      d.type = "button";
      d.setAttribute("aria-label", "Go to package " + (i + 1));
      d.addEventListener("click", () => track.scrollTo({ left: i * stepSize(), behavior: "smooth" }));
      dotsWrap.appendChild(d);
    }
    controls.classList.toggle("hidden", pages <= 1);
    update();
  }

  function update() {
    const x = track.scrollLeft;
    const atEnd = x >= maxScroll() - 2;
    const index = atEnd ? pages - 1 : Math.min(pages - 1, Math.round(x / stepSize()));
    [...dotsWrap.children].forEach((d, i) => d.classList.toggle("active", i === index));
    prev.disabled = x <= 2;
    next.disabled = atEnd;
  }

  prev.addEventListener("click", () => track.scrollBy({ left: -stepSize(), behavior: "smooth" }));
  next.addEventListener("click", () => track.scrollBy({ left: stepSize(), behavior: "smooth" }));

  let ticking = false;
  track.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { update(); ticking = false; });
  });
  window.addEventListener("resize", build);
  build();
})();
