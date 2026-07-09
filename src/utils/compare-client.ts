import type { StorageItem } from './favorites-client';

const STORAGE_KEY = 'navigator_compare';
const MAX_ITEMS = 3;

export function getCompareItems(): StorageItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? '[]',
    ) as StorageItem[];
  } catch {
    return [];
  }
}

export function saveCompareItems(items: StorageItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function updateCompareBadge(): void {
  const count = getCompareItems().length;
  document.querySelectorAll('[data-compare-count]').forEach((el) => {
    el.textContent = String(count);
    (el as HTMLElement).hidden = count === 0;
  });
}

function updateCompareButton(btn: HTMLButtonElement, active: boolean): void {
  btn.classList.toggle('is-active', active);
  if (!btn.classList.contains('compare-btn--compact')) {
    btn.textContent = active ? 'В сравнении' : 'Сравнить';
  }
  btn.setAttribute(
    'aria-label',
    active ? 'Убрать из сравнения' : 'Добавить к сравнению',
  );
}

export function syncCompareButtons(): void {
  const items = getCompareItems();
  document
    .querySelectorAll<HTMLButtonElement>('[data-compare-btn]')
    .forEach((btn) => {
      const id = btn.dataset.courseId;
      if (!id) return;
      updateCompareButton(
        btn,
        items.some((item) => item.id === id),
      );
    });
}

export function initCompare(): void {
  if (typeof document === 'undefined') return;

  const win = window as Window & { __navigatorCompareInit?: boolean };
  if (win.__navigatorCompareInit) {
    syncCompareButtons();
    updateCompareBadge();
    return;
  }
  win.__navigatorCompareInit = true;

  document.addEventListener('click', (event) => {
    const btn = (event.target as Element).closest<HTMLButtonElement>(
      '[data-compare-btn]',
    );
    if (!btn) return;

    const id = btn.dataset.courseId;
    if (!id) return;

    let items = getCompareItems();
    const exists = items.some((item) => item.id === id);

    if (exists) {
      items = items.filter((item) => item.id !== id);
      updateCompareButton(btn, false);
    } else {
      if (items.length >= MAX_ITEMS) {
        alert(`Можно сравнить не более ${MAX_ITEMS} программ.`);
        return;
      }
      items.push({
        id,
        slug: btn.dataset.courseSlug ?? '',
        title: btn.dataset.courseTitle ?? '',
      });
      updateCompareButton(btn, true);
    }

    saveCompareItems(items);
    updateCompareBadge();
    window.dispatchEvent(new CustomEvent('navigator:compare-changed'));
  });

  syncCompareButtons();
  updateCompareBadge();
}
