export function initNavigation(documentRoot = document, Observer = globalThis.IntersectionObserver) {
  if (typeof Observer !== 'function') return;

  const links = [...documentRoot.querySelectorAll('[data-section-link]')];
  const sections = links
    .map((link) => documentRoot.querySelector(link.getAttribute('href')))
    .filter(Boolean);
  const view = documentRoot.defaultView;
  const atPageEnd = () => view && view.scrollY > 0
    && view.scrollY + view.innerHeight >= documentRoot.documentElement.scrollHeight - 2;

  const activate = (section) => {
    if (!section) return;
    links.forEach((link) => link.removeAttribute('aria-current'));
    links.find((link) => link.getAttribute('href') === `#${section.id}`)
      ?.setAttribute('aria-current', 'location');
  };

  view?.addEventListener('scroll', () => {
    if (atPageEnd()) {
      activate(sections.at(-1));
      return;
    }
    const active = sections.filter((section) => section.getBoundingClientRect().top <= view.innerHeight * 0.35).at(-1);
    activate(active || sections[0]);
  }, { passive: true });

  const observer = new Observer((entries) => {
    if (atPageEnd()) {
      activate(sections.at(-1));
      return;
    }
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      activate(entry.target);
    });
  }, {
    rootMargin: '-35% 0px -55%',
    threshold: 0,
  });

  sections.forEach((section) => observer.observe(section));
}
