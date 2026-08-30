export function initNavigation(documentRoot = document, Observer = globalThis.IntersectionObserver) {
  if (typeof Observer !== 'function') return;

  const links = [...documentRoot.querySelectorAll('[data-section-link]')];
  const sections = links
    .map((link) => documentRoot.querySelector(link.getAttribute('href')))
    .filter(Boolean);

  const observer = new Observer((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      links.forEach((link) => link.removeAttribute('aria-current'));
      const activeLink = links.find((link) => link.getAttribute('href') === `#${entry.target.id}`);
      activeLink?.setAttribute('aria-current', 'location');
    });
  }, {
    rootMargin: '-35% 0px -55%',
    threshold: 0,
  });

  sections.forEach((section) => observer.observe(section));
}
