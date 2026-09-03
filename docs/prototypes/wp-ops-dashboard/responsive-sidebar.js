const mobileToggle = document.querySelector("#mobile-sidebar-toggle");
const scrim = document.querySelector("#sidebar-scrim");
const tabs = document.querySelector("#analysis-tabs");

if (mobileToggle && scrim && tabs) {
  const mobileMedia = window.matchMedia("(max-width: 850px)");

  const setOpen = (open) => {
    const isOpen = Boolean(open) && mobileMedia.matches;
    document.body.classList.toggle("sidebar-open", isOpen);
    mobileToggle.setAttribute("aria-expanded", String(isOpen));
    scrim.hidden = !isOpen;
  };

  mobileToggle.addEventListener("click", () => {
    setOpen(!document.body.classList.contains("sidebar-open"));
  });
  scrim.addEventListener("click", () => setOpen(false));
  tabs.querySelector("#sidebar-toggle")?.addEventListener("click", () => setOpen(false));
  tabs.addEventListener("click", (event) => {
    if (event.target.closest(".tab")) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("sidebar-open")) {
      setOpen(false);
      mobileToggle.focus();
    }
  });
  mobileMedia.addEventListener("change", (event) => {
    if (!event.matches) setOpen(false);
  });
}
