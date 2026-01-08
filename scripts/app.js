const scrollPositions = {};

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
  document.title = `YS - ${title}`;
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