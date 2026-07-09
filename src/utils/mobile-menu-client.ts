export function initMobileMenu(): void {
  if (typeof document === 'undefined') return;

  const toggle = document.getElementById('mobile-menu-toggle');
  const panel = document.getElementById('mobile-menu-panel');
  if (!toggle || !panel) return;

  const win = window as Window & { __navigatorMobileMenuInit?: boolean };
  if (win.__navigatorMobileMenuInit) return;
  win.__navigatorMobileMenuInit = true;

  const iconMenu = toggle.querySelector('.mobile-menu__icon-menu');
  const iconClose = toggle.querySelector('.mobile-menu__icon-close');

  function setOpen(open: boolean): void {
    toggle!.setAttribute('aria-expanded', String(open));
    toggle!.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
    panel!.classList.toggle('is-open', open);
    panel!.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('mobile-menu-open', open);

    iconMenu?.classList.toggle('is-hidden', open);
    iconClose?.classList.toggle('is-hidden', !open);
  }

  function close(): void {
    if (toggle!.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
    }
  }

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    const isOpen = toggle.getAttribute('aria-expanded') === 'true';
    setOpen(!isOpen);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });

  document.addEventListener('click', (event) => {
    if (!panel.classList.contains('is-open')) return;
    const target = event.target as Node;
    if (toggle.contains(target) || panel.contains(target)) return;
    close();
  });

  panel.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', close);
  });

  window.addEventListener('resize', () => {
    if (window.matchMedia('(min-width: 768px)').matches) close();
  });
}
