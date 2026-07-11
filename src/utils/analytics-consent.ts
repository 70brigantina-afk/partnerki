export const CONSENT_STORAGE_KEY = 'navigator_analytics_consent';

export type AnalyticsConsentStatus = 'granted' | 'denied';

export interface AnalyticsConsentRecord {
  status: AnalyticsConsentStatus;
  version: string;
  date: string;
}

export function getPolicyVersion(): string {
  return '2026-07-11';
}

export function readAnalyticsConsent(): AnalyticsConsentRecord | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AnalyticsConsentRecord;
    if (parsed.status !== 'granted' && parsed.status !== 'denied') return null;
    if (!parsed.version || !parsed.date) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveAnalyticsConsent(
  status: AnalyticsConsentStatus,
): AnalyticsConsentRecord {
  const record: AnalyticsConsentRecord = {
    status,
    version: getPolicyVersion(),
    date: new Date().toISOString(),
  };
  localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  return record;
}

export function hasAnalyticsConsent(): boolean {
  return readAnalyticsConsent()?.status === 'granted';
}
