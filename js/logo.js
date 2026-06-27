document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("brand-logo-container");
  if (!container) return;

  const text = container.getAttribute("data-text") || "IGPartners";

  container.innerHTML = `
    <span class="brand-badge">
      <img src="/img/logo.png" alt="Logo" class="brand-logo">
      ${text}
    </span>
  `;
});
// Build cache bust: 2026-06-28T02:12:00
