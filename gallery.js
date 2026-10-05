const params = document.body.dataset;
const total = parseInt(params.count, 10);
const container = document.getElementById("gallery");
const photos = [];

for (let i = 1; i <= total; i++) {
  const name = String(i).padStart(2, "0") + ".jpg";
  photos.push(name);
  const img = document.createElement("img");
  img.src = name;
  img.loading = "lazy";
  img.alt = params.title + " photo " + i;
  img.addEventListener("click", () => openLightbox(i - 1));
  container.appendChild(img);
}

const lightbox = document.getElementById("lightbox");
const lightboxImg = lightbox.querySelector("img");
let current = 0;

function show(index) {
  current = (index + photos.length) % photos.length;
  lightboxImg.src = photos[current];
}
function openLightbox(index) {
  show(index);
  lightbox.classList.add("open");
}
function closeLightbox() {
  lightbox.classList.remove("open");
}

lightbox.querySelector(".close").addEventListener("click", closeLightbox);
lightbox.querySelector(".prev").addEventListener("click", () => show(current - 1));
lightbox.querySelector(".next").addEventListener("click", () => show(current + 1));
lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });

document.addEventListener("keydown", (e) => {
  if (!lightbox.classList.contains("open")) return;
  if (e.key === "Escape") closeLightbox();
  if (e.key === "ArrowLeft") show(current - 1);
  if (e.key === "ArrowRight") show(current + 1);
});

document.getElementById("year").textContent = new Date().getFullYear();