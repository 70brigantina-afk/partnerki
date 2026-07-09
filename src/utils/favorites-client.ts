export interface StorageItem {
  id: string;
  slug: string;
  title: string;
}

const STORAGE_KEY = 'navigator_favorites';

export function getFavorites(): StorageItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '[]',
    ) as StorageItem[];
  } catch {
    return [];
  }
}

export function saveFavorites(items: StorageItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function updateFavoriteBadge(): void {
  const count = getFavorites().length;
  document.querySelectorAll('[data-fav-count]').forEach((el) => {
    el.textContent = String(count);
    (el as HTMLElement).hidden = count === 0;
  });
}

function updateFavoriteButton(btn: HTMLButtonElement, active: boolean): void {
  btn.classList.toggle('is-active', active);
  btn.setAttribute(
    'aria-label',
    active ? 'Убрать из избранного' : 'Добавить в избранное',
  );
  const text = btn.querySelector('.fav-btn__text');
  if (text) text.textContent = active ? 'В избранном' : 'В избранное';
}

export function syncFavoriteButtons(): void {
  const favorites = getFavorites();
  document
    .querySelectorAll<HTMLButtonElement>('[data-fav-btn]')
    .forEach((btn) => {
      const id = btn.dataset.courseId;
      if (!id) return;
      updateFavoriteButton(
        btn,
        favorites.some((item) => item.id === id),
      );
    });
}

export function initFavorites(): void {
  if (typeof document === 'undefined') return;

  const win = window as Window & { __navigatorFavoritesInit?: boolean };
  if (win.__navigatorFavoritesInit) {
    syncFavoriteButtons();
    updateFavoriteBadge();
    return;
  }
  win.__navigatorFavoritesInit = true;

  document.addEventListener('click', (event) => {
    const btn = (event.target as Element).closest<HTMLButtonElement>(
      '[data-fav-btn]',
    );
    if (!btn) return;

    const id = btn.dataset.courseId;
    if (!id) return;

    let favorites = getFavorites();
    const exists = favorites.some((item) => item.id === id);

    if (exists) {
      favorites = favorites.filter((item) => item.id !== id);
      updateFavoriteButton(btn, false);
    } else {
      favorites.push({
        id,
        slug: btn.dataset.courseSlug ?? '',
        title: btn.dataset.courseTitle ?? '',
      });
      updateFavoriteButton(btn, true);
    }

    saveFavorites(favorites);
    updateFavoriteBadge();
    window.dispatchEvent(new CustomEvent('navigator:favorites-changed'));
  });

  syncFavoriteButtons();
  updateFavoriteBadge();
}
