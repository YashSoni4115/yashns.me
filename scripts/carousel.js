(function () {
  const root = document.querySelector("[data-carousel]");
  if (!root) return;

  const imgEl = root.querySelector("[data-carousel-img]");
  const capEl = root.querySelector("[data-carousel-cap]");
  const dotsEl = root.querySelector("[data-carousel-dots]");
  const prevBtn = root.querySelector("[data-carousel-prev]");
  const nextBtn = root.querySelector("[data-carousel-next]");

  const slides = [
    { src: "assets/images/carousel/01_friends.jpg", cap: "Friends, good vibes, and a classic pajama lineup" },
    { src: "assets/images/carousel/02_yacht.JPG", cap: "Admiring the sunset from the yacht" },
    { src: "assets/images/carousel/04_catan.jpg", cap: "Who doesn't love catan" }
  ];

  let idx = 0;

  function renderDots() {
    dotsEl.innerHTML = "";
    slides.forEach((_, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "carousel-dot" + (i === idx ? " is-active" : "");
      b.setAttribute("aria-label", `Go to photo ${i + 1}`);
      b.addEventListener("click", () => {
        idx = i;
        render();
      });
      dotsEl.appendChild(b);
    });
  }

  function render() {
    const s = slides[idx];
    imgEl.src = s.src;
    imgEl.alt = s.cap;
    capEl.textContent = s.cap;
    renderDots();
  }

  function next() {
    idx = (idx + 1) % slides.length;
    render();
  }

  function prev() {
    idx = (idx - 1 + slides.length) % slides.length;
    render();
  }

  nextBtn.addEventListener("click", next);
  prevBtn.addEventListener("click", prev);

  root.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  });

  render();
})();
