import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { parse } from 'csv-parse/sync';

const COURSES_DIR = join(process.cwd(), 'src', 'content', 'courses');
const DEFAULT_INPUT = join(process.cwd(), 'data', 'courses-import.csv');
const REPORTS_DIR = join(process.cwd(), 'data', 'import-reports');

const VALID_CATEGORIES = [
  'neyroseti',
  'marketing',
  'psihologiya',
  'zdorove',
  'dizayn',
  'angliyskiy',
] as const;

const VALID_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
const VALID_FORMATS = [
  'video',
  'live',
  'mixed',
  'text',
  'webinar',
  'self-paced',
] as const;
const VALID_TYPES = [
  'profession',
  'skill',
  'intensive',
  'marathon',
  'course',
  'masterclass',
  'webinar',
  'checklist',
  'training',
  'test',
  'test_drive',
  'practicum',
  'video_lesson',
  'collection',
] as const;
const VALID_STATUSES = ['draft', 'active', 'paused', 'archived'] as const;
const VALID_AD_USE_CODES = [
  'manual_check_before_ads',
  'site_only_no_paid_ads',
  'ads_allowed_after_manual_check',
] as const;

const LEVEL_ALIASES: Record<string, (typeof VALID_LEVELS)[number]> = {
  beginner: 'beginner',
  intermediate: 'intermediate',
  advanced: 'advanced',
  'для начинающих': 'beginner',
  начинающий: 'beginner',
  новичок: 'beginner',
  средний: 'intermediate',
  'средний уровень': 'intermediate',
  продвинутый: 'advanced',
};

const FORMAT_ALIASES: Record<string, (typeof VALID_FORMATS)[number]> = {
  video: 'video',
  live: 'live',
  mixed: 'mixed',
  text: 'text',
  webinar: 'webinar',
  'self-paced': 'self-paced',
  masterclass: 'webinar',
  intensive: 'mixed',
  course: 'video',
  profession: 'video',
  checklist: 'text',
  training: 'live',
  test: 'text',
  test_drive: 'text',
  practicum: 'mixed',
  marathon: 'mixed',
  video_lesson: 'video',
  collection: 'text',
};

const REQUIRED_FIELDS = [
  'id',
  'title',
  'category',
  'shortDescription',
  'seoTitle',
  'seoDescription',
  'checkedAt',
] as const;

const FORBIDDEN_URL_MARKERS = [
  '#',
  'example.com',
  'example.org',
  'localhost',
  'вставьте',
  'замените',
  'your-link',
  'your_link',
  'http://test',
  'https://test',
];

const TRANSLIT_MAP: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

type CourseRow = Record<string, string | undefined>;

interface ParsedCourse {
  slug: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

interface RowIssue {
  rowNumber: number;
  id?: string;
  slug?: string;
  level: 'error' | 'warning';
  message: string;
}

interface ImportSummary {
  rowsRead: number;
  created: number;
  skipped: number;
  errors: RowIssue[];
  warnings: RowIssue[];
  plannedFiles: string[];
  blockedPaid: string[];
  incompleteMarkingFree: string[];
  duplicateSlugs: string[];
  duplicateAffiliateUrls: string[];
}

function parseArgs(argv: string[]) {
  const dryRun = argv.includes('--dry-run');
  const force = argv.includes('--force');
  // Берём последнее --input, чтобы npm-скрипт можно было переопределить аргументом.
  const inputIndex = argv.lastIndexOf('--input');
  const input =
    inputIndex !== -1 && argv[inputIndex + 1]
      ? join(process.cwd(), argv[inputIndex + 1])
      : DEFAULT_INPUT;

  return { dryRun, force, input };
}

function normalizeHeader(value: string): string {
  return value.replace(/^\uFEFF/, '').trim();
}

function parseBoolean(
  value: string | undefined,
  fieldName: string,
  rowNumber: number,
  issues: RowIssue[],
  defaultValue = false,
): boolean {
  if (!value?.trim()) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'да', 'д'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'нет', 'н'].includes(normalized)) return false;
  issues.push({
    rowNumber,
    level: 'error',
    message: `Поле "${fieldName}": некорректное логическое значение "${value}". Используйте true/false или да/нет.`,
  });
  return defaultValue;
}

function parseList(value: string | undefined): string[] {
  if (!value?.trim()) return [];
  return value
    .split('|')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNumber(
  value: string | undefined,
  fieldName: string,
  rowNumber: number,
  issues: RowIssue[],
  defaultValue = 0,
): number {
  if (!value?.trim()) return defaultValue;
  const parsed = Number(value.trim());
  if (!Number.isFinite(parsed)) {
    issues.push({
      rowNumber,
      level: 'error',
      message: `Поле "${fieldName}": ожидается число, получено "${value}".`,
    });
    return defaultValue;
  }
  return parsed;
}

function parseDate(
  value: string | undefined,
  fieldName: string,
  rowNumber: number,
  issues: RowIssue[],
  required = false,
): string | undefined {
  if (!value?.trim()) {
    if (required) {
      issues.push({
        rowNumber,
        level: 'error',
        message: `Поле "${fieldName}" обязательно.`,
      });
    }
    return undefined;
  }
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    issues.push({
      rowNumber,
      level: 'error',
      message: `Поле "${fieldName}": используйте формат ГГГГ-ММ-ДД (например, 2026-07-09).`,
    });
    return undefined;
  }
  const date = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    issues.push({
      rowNumber,
      level: 'error',
      message: `Поле "${fieldName}": дата "${trimmed}" некорректна.`,
    });
    return undefined;
  }
  return trimmed;
}

function validateUrl(
  value: string | undefined,
  fieldName: string,
  rowNumber: number,
  issues: RowIssue[],
): string | undefined {
  if (!value?.trim()) return undefined;
  const url = value.trim();

  if (url === '#' || url.startsWith('javascript:')) {
    issues.push({
      rowNumber,
      level: 'error',
      message: `Поле "${fieldName}": запрещённая ссылка "${url}".`,
    });
    return undefined;
  }

  const lower = url.toLowerCase();
  if (FORBIDDEN_URL_MARKERS.some((marker) => lower.includes(marker))) {
    issues.push({
      rowNumber,
      level: 'error',
      message: `Поле "${fieldName}": ссылка выглядит как заглушка. Укажите реальный URL или оставьте поле пустым.`,
    });
    return undefined;
  }

  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      issues.push({
        rowNumber,
        level: 'error',
        message: `Поле "${fieldName}": допускаются только ссылки http/https.`,
      });
      return undefined;
    }
  } catch {
    issues.push({
      rowNumber,
      level: 'error',
      message: `Поле "${fieldName}": некорректный URL "${url}".`,
    });
    return undefined;
  }

  return url;
}

function slugify(value: string): string {
  const lower = value.trim().toLowerCase();
  const transliterated = [...lower]
    .map((char) => TRANSLIT_MAP[char] ?? char)
    .join('');
  return transliterated
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function yamlQuote(value: string): string {
  if (/[\n:"']/.test(value)) {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return `'${value.replace(/'/g, "''")}'`;
}

function yamlValue(key: string, value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return `${key}: ${value}`;
  if (typeof value === 'number') return `${key}: ${value}`;
  if (Array.isArray(value)) {
    if (!value.length) return `${key}: []`;
    const items = value.map((item) => `  - ${yamlQuote(String(item))}`);
    return `${key}:\n${items.join('\n')}`;
  }
  return `${key}: ${yamlQuote(String(value))}`;
}

function buildMarkdown(course: ParsedCourse): string {
  const lines = ['---'];
  const entries: Array<[string, unknown]> = [
    ['id', course.frontmatter.id],
    ['title', course.frontmatter.title],
    ['shortTitle', course.frontmatter.shortTitle],
    ['category', course.frontmatter.category],
    ['subcategory', course.frontmatter.subcategory],
    ['school', course.frontmatter.school],
    ['author', course.frontmatter.author],
    ['shortDescription', course.frontmatter.shortDescription],
    ['fullDescription', course.frontmatter.fullDescription],
    ['type', course.frontmatter.type],
    ['isFree', course.frontmatter.isFree],
    ['hasFreeTrial', course.frontmatter.hasFreeTrial],
    ['priceText', course.frontmatter.priceText],
    ['level', course.frontmatter.level],
    ['format', course.frontmatter.format],
    ['duration', course.frontmatter.duration],
    ['audience', course.frontmatter.audience],
    ['learningOutcomes', course.frontmatter.learningOutcomes],
    ['curriculum', course.frontmatter.curriculum],
    ['advantages', course.frontmatter.advantages],
    ['limitations', course.frontmatter.limitations],
    ['certificate', course.frontmatter.certificate],
    ['feedback', course.frontmatter.feedback],
    ['image', course.frontmatter.image],
    ['officialUrl', course.frontmatter.officialUrl],
    ['affiliateUrl', course.frontmatter.affiliateUrl],
    ['partnerProgram', course.frontmatter.partnerProgram],
    ['tags', course.frontmatter.tags],
    ['featured', course.frontmatter.featured],
    ['recommended', course.frontmatter.recommended],
    ['priority', course.frontmatter.priority],
    ['status', course.frontmatter.status],
    ['checkedAt', course.frontmatter.checkedAt],
    ['publishedAt', course.frontmatter.publishedAt],
    ['updatedAt', course.frontmatter.updatedAt],
    ['seoTitle', course.frontmatter.seoTitle],
    ['seoDescription', course.frontmatter.seoDescription],
    ['disclaimer', course.frontmatter.disclaimer],
    ['isDemo', course.frontmatter.isDemo],
    ['advertiserName', course.frontmatter.advertiserName],
    ['advertiserINN', course.frontmatter.advertiserINN],
    ['advertiserOKVED', course.frontmatter.advertiserOKVED],
    ['advertisingContract', course.frontmatter.advertisingContract],
    ['erid', course.frontmatter.erid],
    ['markingComplete', course.frontmatter.markingComplete],
    ['adUseCode', course.frontmatter.adUseCode],
    ['adUsePolicy', course.frontmatter.adUsePolicy],
  ];

  for (const [key, value] of entries) {
    if (value === undefined || value === '') continue;
    if (Array.isArray(value) && value.length === 0) continue;
    const rendered = yamlValue(key, value);
    if (rendered) lines.push(rendered);
  }

  lines.push('---', '', course.body.trim(), '');
  return lines.join('\n');
}

function getExistingSlugs(): Set<string> {
  if (!existsSync(COURSES_DIR)) return new Set();
  return new Set(
    readdirSync(COURSES_DIR)
      .filter((file) => file.endsWith('.md'))
      .map((file) => file.replace(/\.md$/, '')),
  );
}

function parseCourseRow(
  row: CourseRow,
  rowNumber: number,
  issues: RowIssue[],
): ParsedCourse | null {
  for (const field of REQUIRED_FIELDS) {
    if (!row[field]?.trim()) {
      issues.push({
        rowNumber,
        id: row.id,
        slug: row.slug,
        level: 'error',
        message: `Обязательное поле "${field}" не заполнено.`,
      });
    }
  }

  const category = row.category?.trim() ?? '';
  if (
    category &&
    !VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])
  ) {
    issues.push({
      rowNumber,
      id: row.id,
      slug: row.slug,
      level: 'error',
      message: `Недопустимая категория "${category}". Допустимые значения: ${VALID_CATEGORIES.join(', ')}.`,
    });
  }

  // Импорт всегда создаёт черновики — публикация только вручную.
  const status: (typeof VALID_STATUSES)[number] = 'draft';
  if (row.status?.trim() && row.status.trim() !== 'draft') {
    issues.push({
      rowNumber,
      id: row.id,
      slug: row.slug,
      level: 'warning',
      message: `Статус "${row.status}" принудительно заменён на draft.`,
    });
  }

  const rawLevel = row.level?.trim() || 'beginner';
  const level =
    LEVEL_ALIASES[rawLevel.toLowerCase()] ??
    (VALID_LEVELS.includes(rawLevel as (typeof VALID_LEVELS)[number])
      ? (rawLevel as (typeof VALID_LEVELS)[number])
      : null);
  if (!level) {
    issues.push({
      rowNumber,
      id: row.id,
      slug: row.slug,
      level: 'error',
      message: `Недопустимый level "${row.level}". Допустимые значения: ${VALID_LEVELS.join(', ')} или «Для начинающих».`,
    });
  }

  const rawFormat = row.format?.trim() || 'video';
  const format =
    FORMAT_ALIASES[rawFormat.toLowerCase()] ??
    (VALID_FORMATS.includes(rawFormat as (typeof VALID_FORMATS)[number])
      ? (rawFormat as (typeof VALID_FORMATS)[number])
      : null);
  if (!format) {
    issues.push({
      rowNumber,
      id: row.id,
      slug: row.slug,
      level: 'error',
      message: `Недопустимый format "${row.format}".`,
    });
  } else if (rawFormat !== format) {
    issues.push({
      rowNumber,
      id: row.id,
      slug: row.slug,
      level: 'warning',
      message: `format "${rawFormat}" сопоставлен с "${format}" для схемы сайта.`,
    });
  }

  const type = (row.type?.trim() || 'course') as (typeof VALID_TYPES)[number];
  if (row.type?.trim() && !VALID_TYPES.includes(type)) {
    issues.push({
      rowNumber,
      id: row.id,
      slug: row.slug,
      level: 'error',
      message: `Недопустимый type "${row.type}". Допустимые значения: ${VALID_TYPES.join(', ')}.`,
    });
  }

  const checkedAt = parseDate(
    row.checkedAt,
    'checkedAt',
    rowNumber,
    issues,
    true,
  );
  const publishedAt = parseDate(
    row.publishedAt,
    'publishedAt',
    rowNumber,
    issues,
  );
  const updatedAt = parseDate(row.updatedAt, 'updatedAt', rowNumber, issues);

  const officialUrl = validateUrl(
    row.officialUrl,
    'officialUrl',
    rowNumber,
    issues,
  );
  const affiliateUrl = validateUrl(
    row.affiliateUrl,
    'affiliateUrl',
    rowNumber,
    issues,
  );

  let slug = row.slug?.trim() ?? '';
  if (!slug) {
    slug = slugify(row.title ?? row.id ?? '');
    if (!slug) {
      issues.push({
        rowNumber,
        id: row.id,
        level: 'error',
        message:
          'Не удалось автоматически создать slug. Заполните поле slug вручную.',
      });
    } else {
      issues.push({
        rowNumber,
        id: row.id,
        slug,
        level: 'warning',
        message: `Поле slug не указано. Будет использован автоматический slug: "${slug}".`,
      });
    }
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    issues.push({
      rowNumber,
      id: row.id,
      slug,
      level: 'error',
      message: `Некорректный slug "${slug}". Используйте латиницу, цифры и дефисы.`,
    });
  }

  const isFree = parseBoolean(row.isFree, 'isFree', rowNumber, issues, false);
  const hasFreeTrial = parseBoolean(
    row.hasFreeTrial,
    'hasFreeTrial',
    rowNumber,
    issues,
    false,
  );
  const certificate = parseBoolean(
    row.certificate,
    'certificate',
    rowNumber,
    issues,
    false,
  );
  const feedback = parseBoolean(
    row.feedback,
    'feedback',
    rowNumber,
    issues,
    false,
  );
  const featured = parseBoolean(
    row.featured,
    'featured',
    rowNumber,
    issues,
    false,
  );
  const recommended = parseBoolean(
    row.recommended,
    'recommended',
    rowNumber,
    issues,
    false,
  );
  const priority = parseNumber(row.priority, 'priority', rowNumber, issues, 0);
  const markingComplete = parseBoolean(
    row.markingComplete,
    'markingComplete',
    rowNumber,
    issues,
    false,
  );
  const adUseCodeRaw = row.adUseCode?.trim() ?? '';
  const adUseCode = adUseCodeRaw
    ? (adUseCodeRaw as (typeof VALID_AD_USE_CODES)[number])
    : undefined;
  if (adUseCode && !VALID_AD_USE_CODES.includes(adUseCode)) {
    issues.push({
      rowNumber,
      id: row.id,
      slug: row.slug,
      level: 'error',
      message: `Недопустимый adUseCode "${adUseCodeRaw}". Допустимые: ${VALID_AD_USE_CODES.join(', ')}.`,
    });
  }

  // Правило: платный оффер без ссылки или полной маркировки — пропуск.
  if (!isFree) {
    if (!affiliateUrl || !markingComplete) {
      issues.push({
        rowNumber,
        id: row.id,
        slug: row.slug,
        level: 'error',
        message:
          'Платный продукт пропущен: нужна affiliateUrl и markingComplete=true.',
      });
      return null;
    }
  }

  // Правило: бесплатный с неполной маркировкой — только site_only_no_paid_ads.
  if (isFree && !markingComplete) {
    if (adUseCode !== 'site_only_no_paid_ads') {
      issues.push({
        rowNumber,
        id: row.id,
        slug: row.slug,
        level: 'error',
        message:
          'Бесплатный продукт с неполной маркировкой допускается только при adUseCode=site_only_no_paid_ads.',
      });
      return null;
    }
    issues.push({
      rowNumber,
      id: row.id,
      slug: row.slug,
      level: 'warning',
      message:
        'Неполная маркировка: размещение только на сайте, без платной рекламы (site_only_no_paid_ads).',
    });
  }

  if (
    issues.some(
      (issue) => issue.level === 'error' && issue.rowNumber === rowNumber,
    )
  ) {
    return null;
  }

  if (!level || !format) return null;

  const frontmatter: Record<string, unknown> = {
    id: row.id?.trim(),
    title: row.title?.trim(),
    shortTitle: row.shortTitle?.trim() || row.title?.trim(),
    category,
    subcategory: row.subcategory?.trim() || undefined,
    school: row.school?.trim() || undefined,
    author: row.author?.trim() || undefined,
    shortDescription: row.shortDescription?.trim(),
    fullDescription: row.fullDescription?.trim() || undefined,
    type,
    isFree,
    hasFreeTrial,
    priceText: row.priceText?.trim() || undefined,
    level,
    format,
    duration: row.duration?.trim() || undefined,
    audience: parseList(row.audience),
    learningOutcomes: parseList(row.learningOutcomes),
    curriculum: parseList(row.curriculum),
    advantages: parseList(row.advantages),
    limitations: parseList(row.limitations),
    certificate,
    feedback,
    image: row.image?.trim() || undefined,
    officialUrl,
    affiliateUrl,
    partnerProgram: row.partnerProgram?.trim() || undefined,
    tags: parseList(row.tags),
    featured,
    recommended,
    priority,
    status,
    checkedAt,
    publishedAt,
    updatedAt,
    seoTitle: row.seoTitle?.trim(),
    seoDescription: row.seoDescription?.trim(),
    disclaimer:
      row.disclaimer?.trim() ||
      'Информация носит справочный характер. Перед записью уточните условия на сайте организатора.',
    isDemo: false,
    advertiserName: row.advertiserName?.trim() || undefined,
    advertiserINN: row.advertiserINN?.trim() || undefined,
    advertiserOKVED: row.advertiserOKVED?.trim() || undefined,
    advertisingContract: row.advertisingContract?.trim() || undefined,
    erid: row.erid?.trim() || undefined,
    markingComplete,
    adUseCode,
    adUsePolicy: row.adUsePolicy?.trim() || undefined,
  };

  const body =
    row.fullDescription?.trim() ||
    row.shortDescription?.trim() ||
    'Описание программы будет дополнено.';

  return { slug, frontmatter, body };
}

function writeErrorReport(
  summary: ImportSummary,
  dryRun: boolean,
): string | null {
  const allIssues = [...summary.errors, ...summary.warnings];
  if (!allIssues.length) return null;

  mkdirSync(REPORTS_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportPath = join(
    REPORTS_DIR,
    `import-${dryRun ? 'dry-run-' : ''}errors-${stamp}.txt`,
  );

  const lines = [
    dryRun ? 'Отчёт проверки CSV (dry-run)' : 'Отчёт импорта CSV',
    `Дата: ${new Date().toLocaleString('ru-RU')}`,
    `Строк прочитано: ${summary.rowsRead}`,
    `Создано: ${summary.created}`,
    `Пропущено: ${summary.skipped}`,
    '',
  ];

  if (summary.errors.length) {
    lines.push('Ошибки:');
    for (const issue of summary.errors) {
      lines.push(
        `- Строка ${issue.rowNumber}${issue.slug ? ` (${issue.slug})` : ''}: ${issue.message}`,
      );
    }
    lines.push('');
  }

  if (summary.warnings.length) {
    lines.push('Предупреждения:');
    for (const issue of summary.warnings) {
      lines.push(
        `- Строка ${issue.rowNumber}${issue.slug ? ` (${issue.slug})` : ''}: ${issue.message}`,
      );
    }
  }

  writeFileSync(reportPath, lines.join('\n'), 'utf-8');
  return reportPath;
}

function printSummary(
  summary: ImportSummary,
  dryRun: boolean,
  inputPath: string,
) {
  console.info(
    `\n${dryRun ? 'Проверка CSV (dry-run)' : 'Импорт курсов из CSV'}`,
  );
  console.info(`Файл: ${inputPath}`);
  console.info(`Строк прочитано: ${summary.rowsRead}`);
  console.info(
    `${dryRun ? 'Будет создано файлов' : 'Создано файлов'}: ${summary.created}`,
  );
  console.info(`Пропущено: ${summary.skipped}`);
  console.info(`Ошибок: ${summary.errors.length}`);
  console.info(`Предупреждений: ${summary.warnings.length}`);

  if (summary.blockedPaid.length) {
    console.info(
      `\nПлатные офферы заблокированы (${summary.blockedPaid.length}):`,
    );
    for (const item of summary.blockedPaid) console.info(`  - ${item}`);
  }

  if (summary.incompleteMarkingFree.length) {
    console.info(
      `\nБесплатные с неполной маркировкой (${summary.incompleteMarkingFree.length}):`,
    );
    for (const item of summary.incompleteMarkingFree)
      console.info(`  - ${item}`);
  }

  if (summary.duplicateSlugs.length) {
    console.info(
      `\nДубли slug: ${[...new Set(summary.duplicateSlugs)].join(', ')}`,
    );
  }

  if (summary.duplicateAffiliateUrls.length) {
    console.info(
      `\nДубли affiliateUrl (${summary.duplicateAffiliateUrls.length}):`,
    );
    for (const url of [...new Set(summary.duplicateAffiliateUrls)]) {
      console.info(`  - ${url}`);
    }
  }

  if (summary.plannedFiles.length) {
    console.info(`\n${dryRun ? 'Планируемые файлы' : 'Созданные файлы'}:`);
    for (const file of summary.plannedFiles) {
      console.info(`  - ${file}`);
    }
  }

  if (summary.errors.length) {
    console.error('\nОшибки по строкам:');
    for (const issue of summary.errors) {
      console.error(`  [строка ${issue.rowNumber}] ${issue.message}`);
    }
  }

  if (summary.warnings.length) {
    console.warn('\nПредупреждения:');
    for (const issue of summary.warnings) {
      console.warn(`  [строка ${issue.rowNumber}] ${issue.message}`);
    }
  }
}

function main() {
  const { dryRun, force, input } = parseArgs(process.argv.slice(2));

  if (!existsSync(input)) {
    console.error(`❌ Файл не найден: ${input}`);
    console.error(
      'Скопируйте data/courses-import-template.csv в data/courses-import.csv и заполните таблицу.',
    );
    process.exit(1);
  }

  const raw = readFileSync(input, 'utf-8');
  const records = parse(raw, {
    columns: (headers: string[]) => headers.map(normalizeHeader),
    skip_empty_lines: true,
    relax_column_count: false,
    trim: true,
  }) as CourseRow[];

  const dataRows = records.filter((row) =>
    Object.values(row).some((value) => value?.trim()),
  );

  const summary: ImportSummary = {
    rowsRead: dataRows.length,
    created: 0,
    skipped: 0,
    errors: [],
    warnings: [],
    plannedFiles: [],
    blockedPaid: [],
    incompleteMarkingFree: [],
    duplicateSlugs: [],
    duplicateAffiliateUrls: [],
  };

  const existingSlugs = getExistingSlugs();
  const batchSlugs = new Set<string>();
  const batchAffiliateUrls = new Set<string>();

  for (let index = 0; index < dataRows.length; index += 1) {
    const rowNumber = index + 2;
    const row = dataRows[index];
    const rowIssues: RowIssue[] = [];

    const parsed = parseCourseRow(row, rowNumber, rowIssues);
    const rowErrors = rowIssues.filter((issue) => issue.level === 'error');
    const rowWarnings = rowIssues.filter((issue) => issue.level === 'warning');
    summary.errors.push(...rowErrors);
    summary.warnings.push(...rowWarnings);

    for (const issue of rowErrors) {
      if (issue.message.includes('Платный продукт пропущен')) {
        summary.blockedPaid.push(
          `${row.id ?? 'без-id'}: ${row.title ?? row.slug ?? 'без названия'}`,
        );
      }
    }
    for (const issue of rowWarnings) {
      if (issue.message.includes('Неполная маркировка')) {
        summary.incompleteMarkingFree.push(
          `${row.id ?? 'без-id'}: ${row.title ?? row.slug ?? 'без названия'}`,
        );
      }
    }

    if (!parsed) {
      summary.skipped += 1;
      continue;
    }

    if (batchSlugs.has(parsed.slug)) {
      summary.errors.push({
        rowNumber,
        id: row.id,
        slug: parsed.slug,
        level: 'error',
        message: `Дублирующийся slug "${parsed.slug}" в таблице.`,
      });
      summary.duplicateSlugs.push(parsed.slug);
      summary.skipped += 1;
      continue;
    }
    batchSlugs.add(parsed.slug);

    const affiliateUrl = String(parsed.frontmatter.affiliateUrl ?? '');
    if (affiliateUrl) {
      if (batchAffiliateUrls.has(affiliateUrl)) {
        summary.errors.push({
          rowNumber,
          id: row.id,
          slug: parsed.slug,
          level: 'error',
          message: `Дублирующаяся affiliateUrl. Строка пропущена: ${affiliateUrl}`,
        });
        summary.duplicateAffiliateUrls.push(affiliateUrl);
        summary.skipped += 1;
        continue;
      }
      batchAffiliateUrls.add(affiliateUrl);
    }

    const targetPath = join(COURSES_DIR, `${parsed.slug}.md`);
    const fileExists = existingSlugs.has(parsed.slug);

    if (fileExists && !force) {
      summary.errors.push({
        rowNumber,
        id: row.id,
        slug: parsed.slug,
        level: 'error',
        message: `Файл src/content/courses/${parsed.slug}.md уже существует. Импорт пропущен. Для перезаписи используйте флаг --force.`,
      });
      summary.skipped += 1;
      continue;
    }

    if (parsed.slug.startsWith('demo-') && fileExists && !force) {
      summary.errors.push({
        rowNumber,
        id: row.id,
        slug: parsed.slug,
        level: 'error',
        message:
          'Демонстрационные файлы защищены от перезаписи. Удалите файл вручную или используйте другой slug.',
      });
      summary.skipped += 1;
      continue;
    }

    summary.plannedFiles.push(`src/content/courses/${parsed.slug}.md`);
    summary.created += 1;

    if (!dryRun) {
      mkdirSync(COURSES_DIR, { recursive: true });
      writeFileSync(targetPath, buildMarkdown(parsed), 'utf-8');
      existingSlugs.add(parsed.slug);
    }
  }

  const reportPath = writeErrorReport(summary, dryRun);
  printSummary(summary, dryRun, input);

  if (reportPath) {
    console.info(`\nОтчёт сохранён: ${reportPath}`);
  }

  if (dryRun) {
    console.info('\n✅ Проверка завершена. Файлы проекта не изменены.');
  } else if (summary.created > 0) {
    console.info('\n✅ Импорт завершён.');
  } else {
    console.error('\n❌ Новые файлы не созданы.');
    process.exit(1);
  }

  if (summary.errors.length) {
    process.exit(dryRun ? 0 : summary.created > 0 ? 0 : 1);
  }
}

main();
