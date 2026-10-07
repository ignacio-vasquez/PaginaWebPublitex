export function initPortfolio(documentRoot = document) {
  const filters = documentRoot.querySelectorAll('[data-filter]');
  const figures = documentRoot.querySelectorAll('#trabajos figure[data-category]');
  const dialog = documentRoot.querySelector('#portfolio-dialog');
  const closeButton = dialog?.querySelector('[data-dialog-close]');
  const dialogImage = dialog?.querySelector('[data-dialog-image]');
  const dialogTitle = dialog?.querySelector('[data-dialog-title]');
  const track = documentRoot.querySelector('[data-portfolio-track]');
  const previous = documentRoot.querySelector('[data-portfolio-previous]');
  const next = documentRoot.querySelector('[data-portfolio-next]');
  const focusableSelector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  let backgroundState = [];
  let trigger;

  const slide = (direction) => track?.scrollBy({ left: direction * Math.max(track.clientWidth * 0.78, 280), behavior: 'smooth' });
  previous?.addEventListener('click', () => slide(-1));
  next?.addEventListener('click', () => slide(1));
  track?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') { event.preventDefault(); slide(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); slide(1); }
  });

  filters.forEach((filterButton) => {
    filterButton.addEventListener('click', () => {
      const filter = filterButton.dataset.filter;

      filters.forEach((button) => {
        button.setAttribute('aria-pressed', String(button === filterButton));
      });
      figures.forEach((figure) => {
        figure.hidden = filter !== 'all' && figure.dataset.category !== filter;
      });
    });
  });

  if (!dialog || !closeButton || !dialogImage || !dialogTitle) return;

  const getFocusableElements = () => [...dialog.querySelectorAll(focusableSelector)]
    .filter((element) => !element.closest('[inert], [hidden], [aria-hidden="true"]'));

  const isolateBackground = () => {
    backgroundState = [];

    for (let current = dialog; current.parentElement && current !== documentRoot.body; current = current.parentElement) {
      for (const sibling of current.parentElement.children) {
        if (sibling === current) continue;
        backgroundState.push({ element: sibling, wasInert: sibling.hasAttribute('inert') });
        sibling.setAttribute('inert', '');
      }
    }
  };

  const restoreBackground = () => {
    for (const { element, wasInert } of backgroundState) {
      if (!wasInert) element.removeAttribute('inert');
    }
    backgroundState = [];
  };

  const closeDialog = () => {
    if (dialog.hidden) return;
    dialog.hidden = true;
    documentRoot.body.classList.remove('dialog-open');
    restoreBackground();
    trigger?.focus();
  };

  documentRoot.querySelectorAll('[data-portfolio-open]').forEach((openButton) => {
    openButton.addEventListener('click', () => {
      const figure = openButton.closest('figure');
      const image = figure?.querySelector('img');
      const caption = figure?.querySelector('figcaption');

      if (!image || !caption) return;

      trigger = openButton;
      dialogImage.src = image.src;
      dialogImage.alt = image.alt;
      dialogTitle.textContent = caption.textContent;
      dialog.hidden = false;
      documentRoot.body.classList.add('dialog-open');
      isolateBackground();
      closeButton.focus();
    });
  });

  closeButton.addEventListener('click', closeDialog);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog();
  });
  documentRoot.addEventListener('keydown', (event) => {
    if (dialog.hidden) return;

    if (event.key === 'Escape') {
      closeDialog();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusableElements = getFocusableElements();
    const firstElement = focusableElements[0];
    const lastElement = focusableElements.at(-1);
    if (!firstElement || !lastElement) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    if (!dialog.contains(documentRoot.activeElement)
      || (event.shiftKey && documentRoot.activeElement === firstElement)
      || (!event.shiftKey && documentRoot.activeElement === lastElement)) {
      event.preventDefault();
      (event.shiftKey ? lastElement : firstElement).focus();
    }
  });
  documentRoot.addEventListener('focusin', (event) => {
    if (!dialog.hidden && !dialog.contains(event.target)) {
      (getFocusableElements()[0] || dialog).focus();
    }
  });
}
