function setActive(page) {
  document.querySelectorAll(".tab").forEach((t) => {
    t.classList.toggle("is-active", t.dataset.page === page);
  });

  document.querySelectorAll(".page").forEach((p) => {
    p.classList.toggle("is-active", p.dataset.page === page);
  });

  const title = page.charAt(0).toUpperCase() + page.slice(1);
  document.title = `Yash Soni - ${title}`;
  const titleEl = document.querySelector(".title-text");
  if (titleEl) titleEl.textContent = `Yash Soni - ${title}`;
}

function getPageFromHash() {
  const h = (location.hash || "#home").slice(1);
  const allowed = new Set(["home", "projects", "extras", "contact"]);
  return allowed.has(h) ? h : "home";
}

document.addEventListener("click", (e) => {
  const a = e.target.closest("a");
  if (!a) return;
  const tab = a.closest("[data-page]");
  const pageLink = a.closest("[data-page-link]");

  if (tab) {
    e.preventDefault();
    location.hash = tab.dataset.page;
    return;
  }

  if (pageLink) {
    e.preventDefault();
    location.hash = pageLink.dataset.pageLink;
    return;
  }
});

window.addEventListener("hashchange", () => {
  setActive(getPageFromHash());
});

setActive(getPageFromHash());
