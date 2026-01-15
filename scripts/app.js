const scrollPositions = {};

window.addEventListener("DOMContentLoaded", () => {
  const win = document.querySelector(".window");
  const disp = document.querySelector("#genieWarp feDisplacementMap");
  if (!win || !disp) return;

  win.classList.add("is-genie");
  
  // Set initial hidden state immediately (before delay)
  win.style.opacity = "0";
  win.style.transform = "translateY(180px) scaleX(0.10) scaleY(0.06) skewX(-10deg)";
  disp.setAttribute("scale", "55");

  const delay = 300; // ms delay before animation starts
  const duration = 650; // ms

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function startAnimation() {
    const start = performance.now();

    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const e = easeOutCubic(t);

      // warp starts strong, then relaxes
      const warp = (1 - e) * 55;
      disp.setAttribute("scale", warp.toFixed(2));

      // movement like genie open from dock
      const y = (1 - e) * 180;
      const sx = 0.10 + e * 0.90;
      const sy = 0.06 + e * 0.94;
      const skew = (1 - e) * -10;

      win.style.opacity = String(Math.min(1, e * 1.2));
      win.style.transform = `translateY(${y}px) scaleX(${sx}) scaleY(${sy}) skewX(${skew}deg)`;

      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        disp.setAttribute("scale", "0");
        win.style.opacity = "1";
        win.style.transform = "none";
        win.classList.remove("is-genie");
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
    location.hash = tab.dataset.page; // triggers hashchange
  }
});

window.addEventListener("hashchange", () => {
  const newPage = getPageFromHash();
  setActive(newPage, currentPage);
  currentPage = newPage;
});
setActive(currentPage, null);