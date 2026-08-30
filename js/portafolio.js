export function initPortfolio(documentRoot = document) {
  const filters = documentRoot.querySelectorAll('[data-filter]');
  const figures = documentRoot.querySelectorAll('#trabajos figure[data-category]');
  const dialog = documentRoot.querySelector('#portfolio-dialog');
  const closeButton = dialog?.querySelector('[data-dialog-close]');
  const dialogImage = dialog?.querySelector('[data-dialog-image]');
  const dialogTitle = dialog?.querySelector('[data-dialog-title]');
  let trigger;

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

  const closeDialog = () => {
    dialog.hidden = true;
    documentRoot.body.classList.remove('dialog-open');
    trigger?.focus();
  };

  documentRoot.querySelectorAll('[data-portfolio-open]').forEach((openButton) => {
    openButton.addEventListener('click', () => {
      const figure = openButton.closest('figure');
      const image = figure?.querySelector('img');
      const caption = figure?.querySelector('figcaption');

      if (!image || !caption) return;

      trigger = documentRoot.activeElement;
      dialogImage.src = image.src;
      dialogImage.alt = image.alt;
      dialogTitle.textContent = caption.textContent;
      dialog.hidden = false;
      documentRoot.body.classList.add('dialog-open');
      closeButton.focus();
    });
  });

  closeButton.addEventListener('click', closeDialog);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog();
  });
  documentRoot.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !dialog.hidden) closeDialog();
  });
}
