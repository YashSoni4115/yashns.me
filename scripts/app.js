const scrollPositions = {};

window.addEventListener("DOMContentLoaded", () => {
  const win = document.querySelector(".window");
  if (!win) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) return; // leave the window in its natural, fully-visible state

  // --- Genie window-open effect -------------------------------------------
  // Real macOS-style pinch: a narrow neck at the bottom-center anchor widens
  // over time, top edge extrudes and reaches full width first, bottom (neck)
  // lags behind. Driven by an animated clip-path polygon + translateY/scaleY.
  //
  // Geometry: sample ROWS+1 horizontal slices down the window. For each row y
  // in [0,1] (0 = top, 1 = bottom/neck) compute per-row progress
  //   p = clamp((t - y*LAG) / (1 - LAG), 0, 1)
  // Top rows lead, bottom rows lag by LAG of the timeline. Half-width per row
  // eases from MIN_HALF (visible "cord") up to 0.5 (full width) via easeOutCubic.

  const ROWS = 16;
  const LAG = 0.42;       // fraction of timeline that the neck lags top edge by
  const MIN_HALF = 0.018; // 1.8% min half-width so the neck cord stays visible

  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function easeOutBack(t) {
    const c1 = 1.4, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  // Pre-allocate one array of point strings; overwrite in place each frame to
  // avoid per-frame array allocations inside the rAF loop.
  const pts = new Array((ROWS + 1) * 2);

  function buildClip(t) {
    // Down the right side (top -> bottom), then up the left side (bottom -> top).
    for (let i = 0; i <= ROWS; i++) {
      const y = i / ROWS;
      const raw = (t - y * LAG) / (1 - LAG);
      const p = raw < 0 ? 0 : raw > 1 ? 1 : raw;
      const halfW = MIN_HALF + (0.5 - MIN_HALF) * easeOutCubic(p);
      const yPct = (y * 100).toFixed(2);
      pts[i] = ((0.5 + halfW) * 100).toFixed(2) + "% " + yPct + "%";
      // left side, reversed order (bottom row goes to index ROWS+1, top to end)
      pts[2 * ROWS + 1 - i] = ((0.5 - halfW) * 100).toFixed(2) + "% " + yPct + "%";
    }
    return "polygon(" + pts.join(",") + ")";
  }

  const delay = 150;             // ms
  const duration = 620;          // ms — genie pull-open
  const settleDuration = 180;    // ms — soft overshoot settle

  // Initial hidden state (before delay timer, to avoid FOUC)
  win.classList.add("is-genie");
  win.style.opacity = "0";
  win.style.transform = "translateY(80px) scaleY(0.06)";
  win.style.clipPath = buildClip(0);

  function settle() {
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / settleDuration);
      const e = easeOutBack(t);
      const s = 0.98 + e * 0.02; // 0.98 -> ~1.01 -> 1
      win.style.transform = "scale(" + s.toFixed(4) + ")";
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        win.style.transform = "";
        win.classList.remove("is-genie");
      }
    }
    requestAnimationFrame(frame);
  }

  function startAnimation() {
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const e = easeOutCubic(t);

      const y = (1 - e) * 80;                 // slide up from 80px below
      const sy = 0.06 + e * 0.94;             // vertical extrude 0.06 -> 1
      win.style.transform = "translateY(" + y.toFixed(2) + "px) scaleY(" + sy.toFixed(3) + ")";
      win.style.clipPath = buildClip(t);
      win.style.opacity = t < 0.15 ? (t / 0.15).toFixed(3) : "1";

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        // Fully clear per-frame styling — other code shouldn't inherit a
        // clip-path/filter/transform after the animation finishes.
        win.style.clipPath = "";
        win.style.opacity = "1";
        settle();
      }
    }
    requestAnimationFrame(frame);
  }

  setTimeout(startAnimation, delay);
});



function setActive(page, prevPage) {
  // Save scroll position of previous page
  const client = document.querySelector(".client-inner");
  if (prevPage && client) {
    scrollPositions[prevPage] = client.scrollTop;
  }

  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("is-active", t.dataset.page === page);
  });

  document.querySelectorAll(".page").forEach((p) => {
    p.classList.toggle("is-active", p.dataset.page === page);
  });

  // Restore scroll position for new page (default to top)
  if (client) {
    client.scrollTop = scrollPositions[page] || 0;
  }

  const title = page.charAt(0).toUpperCase() + page.slice(1);
  document.title = `Yash Soni - ${title}`;
  const titleEl = document.querySelector(".title-text");
  if (titleEl) titleEl.textContent = title;
}

let currentPage = getPageFromHash();

function getPageFromHash() {
  const h = (location.hash || "#home").slice(1);
  const allowed = new Set(["home", "projects", "extras", "contact"]);
  return allowed.has(h) ? h : "home";
}

document.addEventListener("click", (e) => {
  const a = e.target.closest("a");
  if (!a) return;

  const tab = a.closest("a[data-page]");
  if (tab) {
    e.preventDefault();
    const newPage = tab.dataset.page;
    setActive(newPage, currentPage);
    currentPage = newPage;
    /* notify Mario game of manual page switch */
    if (window.marioGame?.isActive()) window.marioGame.onPageSwitch();
  }
});

setActive(currentPage, null);

/* allow Mario (and other scripts) to switch pages */
window.navigateTo = function (page) {
  setActive(page, currentPage);
  currentPage = page;
};