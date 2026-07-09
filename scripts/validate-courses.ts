import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const coursesDir = join(process.cwd(), 'src', 'content', 'courses');
const REQUIRED_ACTIVE_FIELDS = [
  'id',
  'title',
  'category',
  'shortDescription',
  'checkedAt',
  'seoTitle',
  'seoDescription',
];

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

function main() {
  const files = readdirSync(coursesDir).filter((f) => f.endsWith('.md'));
  let hasErrors = false;
  const warnings: string[] = [];

  for (const file of files) {
    const raw = readFileSync(join(coursesDir, file), 'utf-8');
    const data = parseFrontmatter(raw);
    const slug = file.replace(/\.md$/, '');

    if (data.status !== 'active') continue;

    const missing = REQUIRED_ACTIVE_FIELDS.filter((field) => !data[field]);
    if (missing.length) {
      hasErrors = true;
      console.error(
        `❌ Активная программа "${data.title ?? slug}" (${slug}) — отсутствуют поля: ${missing.join(', ')}`,
      );
    }

    if (!data.affiliateUrl) {
      warnings.push(
        `⚠️  Программа "${data.title ?? slug}" (${slug}) — нет партнёрской ссылки affiliateUrl`,
      );
    }
  }

  if (warnings.length) {
    console.warn('\nПредупреждения по партнёрским ссылкам:\n');
    warnings.forEach((w) => console.warn(w));
  }

  const all = files.length;
  const active = files.filter((f) => {
    const data = parseFrontmatter(readFileSync(join(coursesDir, f), 'utf-8'));
    return data.status === 'active';
  }).length;

  console.info(`\nПроверено файлов: ${all}, активных: ${active}`);

  if (hasErrors) {
    console.error(
      '\nСборка прервана: исправьте обязательные поля активных программ.',
    );
    process.exit(1);
  }

  console.info('\n✅ Валидация курсов пройдена.');
}

main();
