export function initMenu(documentRoot = document) {
  const button = documentRoot.querySelector('#menu-button');
  const navigation = documentRoot.querySelector('#primary-navigation');

  if (!button || !navigation) return;

  const mediaQuery = globalThis.matchMedia?.('(min-width: 48rem)');
  const isDesktop = () => mediaQuery?.matches ?? false;

  function openMenu() {
    button.setAttribute('aria-expanded', 'true');
    navigation.hidden = false;
  }

  function closeMenu({ restoreFocus = false } = {}) {
    button.setAttribute('aria-expanded', 'false');
    navigation.hidden = !isDesktop();

    if (restoreFocus) button.focus();
  }

  button.addEventListener('click', () => {
    if (button.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      return;
    }

    openMenu();
  });

  navigation.addEventListener('click', (event) => {
    if (event.target.closest('a')) closeMenu();
  });

  documentRoot.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') {
      closeMenu({ restoreFocus: true });
    }
  });

  if (mediaQuery) {
    mediaQuery.addEventListener('change', (event) => {
      if (event.matches) {
        navigation.hidden = false;
      } else {
        closeMenu();
      }
    });
  }

  if (isDesktop()) {
    navigation.hidden = false;
  } else {
    closeMenu();
  }
}
