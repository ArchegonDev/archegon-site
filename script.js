const header = document.querySelector("[data-header]");

const syncHeader = () => {
  if (!header) return;
  header.dataset.scrolled = window.scrollY > 16 ? "true" : "false";
};

syncHeader();
window.addEventListener("scroll", syncHeader, { passive: true });
