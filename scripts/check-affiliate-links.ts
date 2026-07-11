/**
 * Safe affiliate URL probe. Does NOT change course files or statuses.
 * Reports inactive offers, HTTP errors, and suspicious landing pages.
 *
 * Usage: npx tsx scripts/check-affiliate-links.ts
 * Optional: --slug=neyroseti-dlya-biznesa  (check one course)
 */
import { readFileSync, readdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const coursesDir = join(process.cwd(), 'src', 'content', 'courses');
const INACTIVE_MARKERS = [
  'данный оффер в данный момент не активен',
  'оффер не активен',
  'offer is inactive',
  'offer is not active',
];

const slugFilter = process.argv
  .find((a) => a.startsWith('--slug='))
  ?.slice('--slug='.length);

type CourseMeta = {
  file: string;
  slug: string;
  title: string;
  school: string;
  status: string;
  affiliateUrl: string;
};

type ProbeResult = {
  ok: boolean;
  status: number;
  finalUrl: string;
  title: string;
  h1: string;
  inactiveMarker: string | null;
  emptyPage: boolean;
  hasForm: boolean;
};

function parseFrontmatter(raw: string): Record<string, string> {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const data: Record<string, string> = {};
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return data;
}

function loadCourses(): CourseMeta[] {
  return readdirSync(coursesDir)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const raw = readFileSync(join(coursesDir, file), 'utf-8');
      const data = parseFrontmatter(raw);
      return {
        file,
        slug: file.replace(/\.md$/, ''),
        title: data.title ?? file,
        school: data.school ?? '',
        status: data.status ?? 'draft',
        affiliateUrl: data.affiliateUrl ?? '',
      };
    })
    .filter((c) => c.affiliateUrl.startsWith('http'))
    .filter((c) => !slugFilter || c.slug === slugFilter);
}

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

function extractH1(html: string): string {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  return m
    ? m[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    : '';
}

function hasRegistrationForm(html: string): boolean {
  const lower = html.toLowerCase();
  return (
    /<form[\s>]/i.test(html) &&
    (lower.includes('type="email"') ||
      lower.includes("type='email'") ||
      lower.includes('регистр') ||
      lower.includes('оставить заявку') ||
      lower.includes('записаться') ||
      lower.includes('телефон') ||
      lower.includes('phone'))
  );
}

function findInactiveMarker(html: string): string | null {
  const lower = html.toLowerCase();
  for (const marker of INACTIVE_MARKERS) {
    if (lower.includes(marker)) return marker;
  }
  return null;
}

function toProbeResult(
  status: number,
  finalUrl: string,
  html: string,
): ProbeResult {
  return {
    ok: status >= 200 && status < 400,
    status,
    finalUrl,
    title: extractTitle(html),
    h1: extractH1(html),
    inactiveMarker: findInactiveMarker(html),
    emptyPage: html.replace(/<[^>]+>/g, '').trim().length < 80,
    hasForm: hasRegistrationForm(html),
  };
}

function probeWithCurl(url: string): ProbeResult | null {
  const dir = mkdtempSync(join(tmpdir(), 'aff-'));
  const outFile = join(dir, 'page.html');
  const bin = process.platform === 'win32' ? 'curl.exe' : 'curl';
  const r = spawnSync(
    bin,
    [
      '-sL',
      '-A',
      'Mozilla/5.0 (compatible; NavigatorObucheniyaLinkCheck/1.0)',
      '--max-redirs',
      '12',
      '--max-time',
      '25',
      '-o',
      outFile,
      '-w',
      '%{url_effective}\n%{http_code}',
      url,
    ],
    { encoding: 'utf8' },
  );
  if (r.error || r.status !== 0) return null;
  const lines = (r.stdout || '').trim().split(/\r?\n/);
  const finalUrl = lines[0] || url;
  const status = Number(lines[1] || 0);
  let html = '';
  try {
    html = readFileSync(outFile, 'utf8');
  } catch {
    html = '';
  }
  writeFileSync(join(dir, 'meta.txt'), `${finalUrl}\n${status}`);
  return toProbeResult(status, finalUrl, html);
}

async function probeWithFetch(url: string): Promise<ProbeResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; NavigatorObucheniyaLinkCheck/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    const html = await res.text();
    return toProbeResult(res.status, res.url, html);
  } finally {
    clearTimeout(timeout);
  }
}

async function probe(url: string): Promise<ProbeResult> {
  try {
    return await probeWithFetch(url);
  } catch {
    const viaCurl = probeWithCurl(url);
    if (viaCurl) return viaCurl;
    throw new Error('fetch failed and curl fallback unavailable');
  }
}

function suspiciousLanding(
  course: CourseMeta,
  finalUrl: string,
  title: string,
  h1: string,
): string | null {
  const host = (() => {
    try {
      return new URL(finalUrl).hostname.replace(/^www\./, '');
    } catch {
      return '';
    }
  })();
  const path = (() => {
    try {
      return new URL(finalUrl).pathname || '/';
    } catch {
      return '/';
    }
  })();
  const text = `${title} ${h1}`.toLowerCase();
  const shortTitle = (course.title || '')
    .toLowerCase()
    .replace(/^вебинар\s*[«"–-]?\s*/i, '')
    .replace(/[«»"']/g, '')
    .trim();

  if (host === 'zerocoder.ru' || host.endsWith('.zerocoder.ru')) {
    const isHome = path === '/' || path === '';
    const h1IsGeneric =
      text.includes('зерокодинг') ||
      text.includes('университет зеро') ||
      text.includes('учить быстро зарабатывать');
    const titleMentionsExact =
      shortTitle.length > 8 && text.includes(shortTitle);
    if (isHome && h1IsGeneric && !titleMentionsExact) {
      return 'Ведёт на общую главную ZeroCoder, а не на страницу вебинара';
    }
  }

  // ihclick/JS-редиректоры без финального HTML не считаем ошибкой автоматически:
  // их нужно открывать в браузере. Сообщаем только явные проблемы лендинга.

  if (host && course.school) {
    const schoolHint = course.school.toLowerCase();
    if (
      schoolHint.includes('zerocoder') &&
      host !== 'zerocoder.ru' &&
      !host.includes('zerocoder') &&
      !host.includes('ihclick') &&
      !host.includes('getcourse') &&
      !host.includes('tilda')
    ) {
      return `Домен лендинга (${host}) не похож на школу «${course.school}»`;
    }
  }

  return null;
}

async function main() {
  const courses = loadCourses();
  console.log(`Проверяю партнёрские ссылки: ${courses.length}\n`);

  const inactive: string[] = [];
  const httpErrors: string[] = [];
  const suspicious: string[] = [];
  const details: Array<Record<string, unknown>> = [];

  for (const course of courses) {
    process.stdout.write(`→ ${course.slug} ... `);
    try {
      const result = await probe(course.affiliateUrl);
      const row = {
        slug: course.slug,
        title: course.title,
        status: course.status,
        affiliateUrl: course.affiliateUrl,
        httpStatus: result.status,
        finalUrl: result.finalUrl,
        pageTitle: result.title,
        h1: result.h1,
        hasForm: result.hasForm,
        inactiveMarker: result.inactiveMarker,
      };
      details.push(row);

      if ([404, 410, 500, 502, 503].includes(result.status)) {
        httpErrors.push(
          `${course.slug}: HTTP ${result.status} → ${result.finalUrl}`,
        );
        console.log(`HTTP ${result.status}`);
        continue;
      }

      if (result.inactiveMarker) {
        inactive.push(
          `${course.slug}: «${result.inactiveMarker}» (${result.finalUrl})`,
        );
        console.log('INACTIVE OFFER');
        continue;
      }

      if (result.emptyPage) {
        suspicious.push(`${course.slug}: пустая/почти пустая страница`);
        console.log('EMPTY');
        continue;
      }

      const land = suspiciousLanding(
        course,
        result.finalUrl,
        result.title,
        result.h1,
      );
      if (land) {
        suspicious.push(`${course.slug}: ${land} → ${result.finalUrl}`);
        console.log('SUSPICIOUS');
        continue;
      }

      console.log(`OK (${result.status})`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      httpErrors.push(`${course.slug}: ошибка запроса — ${message}`);
      console.log(`ERROR: ${message}`);
    }
  }

  console.log('\n========== ОТЧЁТ ==========');
  if (inactive.length) {
    console.log('\nНеактивные офферы:');
    inactive.forEach((l) => console.log(`  - ${l}`));
  } else {
    console.log('\nНеактивные офферы: не найдены');
  }

  if (httpErrors.length) {
    console.log('\nHTTP/сетевые ошибки:');
    httpErrors.forEach((l) => console.log(`  - ${l}`));
  }

  if (suspicious.length) {
    console.log('\nПодозрительные лендинги (ручная проверка):');
    suspicious.forEach((l) => console.log(`  - ${l}`));
  } else {
    console.log('\nПодозрительные лендинги: не найдены');
  }

  if (slugFilter) {
    console.log('\nДетали по --slug:');
    console.log(JSON.stringify(details[0] ?? null, null, 2));
  }

  console.log(
    `\nИтого: inactive=${inactive.length}, http/errors=${httpErrors.length}, suspicious=${suspicious.length}`,
  );
  console.log(
    'Статусы и ссылки курсов этим скриптом НЕ изменяются — только отчёт.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
