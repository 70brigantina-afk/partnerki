import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const pagesDir = join(process.cwd(), 'src', 'pages');
const hrefRegex = /href=["'](\/[^"'#][^"']*)["']/g;

function collectFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return collectFiles(full);
    if (/\.(astro|md|html)$/.test(entry.name)) return [full];
    return [];
  });
}

const files = collectFiles(pagesDir);
const hrefs = new Set<string>();

for (const file of files) {
  const content = readFileSync(file, 'utf-8');
  let match;
  while ((match = hrefRegex.exec(content)) !== null) {
    hrefs.add(match[1].replace(/\/$/, '') || '/');
  }
}

const knownRoutes = new Set([
  '/',
  '/besplatnye',
  '/platnye',
  '/podbor-obucheniya',
  '/sravnenie',
  '/izbrannoe',
  '/o-proekte',
  '/kontakty',
  '/politika-konfidentsialnosti',
  '/polzovatelskoe-soglashenie',
  '/partnerskoe-raskrytie',
  '/reklama',
  '/neyroseti',
  '/marketing',
  '/psihologiya',
  '/zdorove',
  '/dizayn',
  '/angliyskiy',
]);

let issues = 0;
for (const href of hrefs) {
  if (href.startsWith('/course/')) continue;
  if (href.includes('[')) continue;
  const normalized = href.replace(/\/$/, '') || '/';
  if (!knownRoutes.has(normalized) && !normalized.includes('mailto:')) {
    console.warn(`⚠️  Проверьте маршрут: ${href}`);
    issues++;
  }
}

if (issues === 0) {
  console.log('✅ Базовая проверка внутренних ссылок завершена.');
} else {
  console.log(`Найдено предупреждений: ${issues}`);
}
