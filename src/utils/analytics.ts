import type { UtmParams } from './utm';
import { hasAnalyticsConsent } from './analytics-consent';

export interface AffiliateClickEvent {
  courseId: string;
  courseTitle: string;
  category: string;
  school: string;
  isFree: boolean;
  pageUrl: string;
  utm: UtmParams;
  cardPosition?: number;
  buttonType: 'card' | 'detail' | 'comparison';
}

declare global {
  interface Window {
    ym?: (id: number, method: string, ...args: unknown[]) => void;
  }
}

export function trackAffiliateClick(event: AffiliateClickEvent): void {
  if (typeof window === 'undefined') return;
  if (!hasAnalyticsConsent()) return;

  const payload = {
    courseId: event.courseId,
    courseTitle: event.courseTitle,
    category: event.category,
    school: event.school,
    isFree: event.isFree,
    pageUrl: event.pageUrl,
    utm: event.utm,
    cardPosition: event.cardPosition,
    buttonType: event.buttonType,
  };

  if (import.meta.env.DEV) {
    console.info('[analytics] affiliate_click', payload);
  }

  const metrikaId = import.meta.env.PUBLIC_YANDEX_METRIKA_ID;
  if (metrikaId && typeof window.ym === 'function') {
    const id = Number(metrikaId);
    if (!Number.isNaN(id)) {
      try {
        window.ym(id, 'reachGoal', 'affiliate_click', payload);
      } catch {
        /* ignore */
      }
    }
  }
}

export function initAnalytics(): void {
  if (!hasAnalyticsConsent()) return;

  const metrikaId = import.meta.env.PUBLIC_YANDEX_METRIKA_ID;
  if (!metrikaId || typeof document === 'undefined') return;

  const id = Number(metrikaId);
  if (Number.isNaN(id)) return;

  if (document.getElementById('yandex-metrika')) return;

  const script = document.createElement('script');
  script.id = 'yandex-metrika';
  script.async = true;
  script.src = 'https://mc.yandex.ru/metrika/tag.js';
  document.head.appendChild(script);

  script.onload = () => {
    if (typeof window.ym === 'function') {
      window.ym(id, 'init', {
        clickmap: false,
        trackLinks: true,
        accurateTrackBounce: true,
        webvisor: false,
        ecommerce: false,
      });
    }
  };
}
