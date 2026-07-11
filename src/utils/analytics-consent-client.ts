import { initAnalytics } from './analytics';
import {
  readAnalyticsConsent,
  saveAnalyticsConsent,
  type AnalyticsConsentStatus,
} from './analytics-consent';

function getRoot(): HTMLElement | null {
  return document.querySelector('[data-analytics-consent-root]');
}

function showPanel(mode: 'banner' | 'settings'): void {
  const root = getRoot();
  if (!root) return;
  root.hidden = false;
  root.dataset.mode = mode;
  const panel = root.querySelector<HTMLElement>(
    '[data-analytics-consent-panel]',
  );
  panel?.focus();
}

function hidePanel(): void {
  const root = getRoot();
  if (!root) return;
  root.hidden = true;
}

function showNotice(message: string): void {
  const existing = document.querySelector('[data-analytics-consent-notice]');
  existing?.remove();

  const notice = document.createElement('div');
  notice.className = 'analytics-consent-notice';
  notice.setAttribute('data-analytics-consent-notice', '');
  notice.setAttribute('role', 'status');
  notice.textContent = message;
  document.body.appendChild(notice);

  window.setTimeout(() => notice.remove(), 6000);
}

function applyConsent(
  status: AnalyticsConsentStatus,
  previous: AnalyticsConsentStatus | null,
): void {
  saveAnalyticsConsent(status);

  if (status === 'granted') {
    initAnalytics();
    if (previous === 'denied') {
      showNotice(
        'Аналитика включена. Счётчик загрузится, если он настроен на сайте.',
      );
    }
    return;
  }

  if (previous === 'granted') {
    sessionStorage.setItem('navigator_consent_revoke_notice', '1');
    window.location.reload();
  }
}

function bindActions(): void {
  const root = getRoot();
  if (!root) return;

  root
    .querySelectorAll<HTMLButtonElement>('[data-consent-action]')
    .forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.consentAction as
          AnalyticsConsentStatus | 'close';
        if (action !== 'granted' && action !== 'denied') {
          hidePanel();
          return;
        }

        const previous = readAnalyticsConsent()?.status ?? null;
        applyConsent(action, previous);
        hidePanel();
      });
    });

  document
    .querySelectorAll<HTMLElement>('[data-cookie-settings]')
    .forEach((trigger) => {
      trigger.addEventListener('click', () => showPanel('settings'));
    });

  root
    .querySelectorAll<HTMLElement>('[data-consent-close]')
    .forEach((button) => {
      button.addEventListener('click', () => hidePanel());
    });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && root && !root.hidden) {
      hidePanel();
    }
  });
}

export function initAnalyticsConsent(): void {
  if (typeof document === 'undefined') return;

  const win = window as Window & { __navigatorAnalyticsConsentInit?: boolean };
  if (win.__navigatorAnalyticsConsentInit) return;
  win.__navigatorAnalyticsConsentInit = true;

  bindActions();

  if (sessionStorage.getItem('navigator_consent_revoke_notice')) {
    sessionStorage.removeItem('navigator_consent_revoke_notice');
    showNotice(
      'Настройка изменена. Новые данные в Яндекс Метрику отправляться не будут. Уже переданные данные удаляются только по правилам сервиса Яндекса.',
    );
  }

  const existing = readAnalyticsConsent();
  if (existing?.status === 'granted') {
    initAnalytics();
    return;
  }

  if (!existing) {
    showPanel('banner');
  }
}
