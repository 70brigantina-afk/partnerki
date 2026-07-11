import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import type { CourseData } from '@/content/config';
import { getCategoryById } from '@/config/categories';

export type CourseEntry = CollectionEntry<'courses'>;

export const showDrafts = import.meta.env.DEV
  ? import.meta.env.PUBLIC_SHOW_DRAFTS !== 'false'
  : import.meta.env.PUBLIC_SHOW_DRAFTS === 'true';

/** Synonyms used for search matching by category. */
export const categorySearchAliases: Record<string, string[]> = {
  neyroseti: ['нейросети', 'искусственный интеллект', 'ai'],
  marketing: ['маркетинг', 'продвижение', 'реклама'],
  psihologiya: ['психология'],
  zdorove: ['здоровье', 'питание', 'нутрициология'],
  dizayn: ['дизайн', 'визуальные профессии'],
  angliyskiy: ['английский', 'английский язык'],
};

export function isPublicCourse(course: CourseData): boolean {
  if (course.status === 'active') return true;
  if (course.status === 'draft' && showDrafts) return true;
  return false;
}

export function isIndexable(course: CourseData): boolean {
  return course.status === 'active';
}

export function isRealCourse(course: CourseEntry): boolean {
  return !course.data.isDemo;
}

/**
 * Demo courses are fallback only: if the list has any real program,
 * hide demos; otherwise keep demos so empty sections still have content.
 */
export function preferRealCourses(courses: CourseEntry[]): CourseEntry[] {
  const real = courses.filter(isRealCourse);
  return real.length > 0 ? real : courses;
}

export function hasOnlyDemoCourses(courses: CourseEntry[]): boolean {
  return courses.length > 0 && courses.every((c) => c.data.isDemo);
}

function sortByPriorityThenChecked(a: CourseEntry, b: CourseEntry): number {
  if (b.data.priority !== a.data.priority) {
    return b.data.priority - a.data.priority;
  }
  return b.data.checkedAt.getTime() - a.data.checkedAt.getTime();
}

function fillCourseList(
  primary: CourseEntry[],
  pool: CourseEntry[],
  limit: number,
): CourseEntry[] {
  if (primary.length >= limit) return primary.slice(0, limit);
  const seen = new Set(primary.map((c) => c.slug));
  const fillers = pool
    .filter((c) => !seen.has(c.slug))
    .sort(sortByPriorityThenChecked);
  return [...primary, ...fillers].slice(0, limit);
}

export async function getPublicCourses(): Promise<CourseEntry[]> {
  const all = await getCollection('courses');
  return all.filter((c) => isPublicCourse(c.data));
}

export async function getActiveCourses(): Promise<CourseEntry[]> {
  const all = await getCollection('courses');
  return all.filter((c) => c.data.status === 'active');
}

export async function getCourseBySlug(
  slug: string,
): Promise<CourseEntry | undefined> {
  const all = await getPublicCourses();
  return all.find((c) => c.slug === slug);
}

export function getCoursesByCategory(
  courses: CourseEntry[],
  categoryId: string,
): CourseEntry[] {
  return preferRealCourses(
    courses.filter((c) => c.data.category === categoryId),
  );
}

export function getFeaturedCourses(
  courses: CourseEntry[],
  limit = 8,
): CourseEntry[] {
  const pool = preferRealCourses(courses);
  const featured = pool
    .filter((c) => c.data.featured)
    .sort((a, b) => b.data.priority - a.data.priority);
  return fillCourseList(featured, pool, limit);
}

export function getRecommendedCourses(
  courses: CourseEntry[],
  limit = 3,
): CourseEntry[] {
  const pool = preferRealCourses(courses);
  const recommended = pool
    .filter((c) => c.data.recommended)
    .sort((a, b) => b.data.priority - a.data.priority);
  return fillCourseList(recommended, pool, limit);
}

export function getFreeCourses(courses: CourseEntry[]): CourseEntry[] {
  return preferRealCourses(courses.filter((c) => c.data.isFree));
}

export function getPaidCourses(courses: CourseEntry[]): CourseEntry[] {
  return preferRealCourses(courses.filter((c) => !c.data.isFree));
}

export function sortCourses(
  courses: CourseEntry[],
  sort: string,
): CourseEntry[] {
  const sorted = [...courses];
  switch (sort) {
    case 'free-first':
      return sorted.sort(
        (a, b) => Number(b.data.isFree) - Number(a.data.isFree),
      );
    case 'paid-first':
      return sorted.sort(
        (a, b) => Number(a.data.isFree) - Number(b.data.isFree),
      );
    case 'priority':
      return sorted.sort((a, b) => b.data.priority - a.data.priority);
    case 'duration':
      return sorted.sort((a, b) => {
        const order = { short: 0, long: 1 };
        const av = a.data.durationCategory ? order[a.data.durationCategory] : 2;
        const bv = b.data.durationCategory ? order[b.data.durationCategory] : 2;
        return av - bv;
      });
    case 'updated':
      return sorted.sort((a, b) => {
        const ad = a.data.updatedAt ?? a.data.checkedAt;
        const bd = b.data.updatedAt ?? b.data.checkedAt;
        return bd.getTime() - ad.getTime();
      });
    case 'recommended':
    default:
      return sorted.sort((a, b) => {
        if (a.data.recommended !== b.data.recommended) {
          return Number(b.data.recommended) - Number(a.data.recommended);
        }
        return b.data.priority - a.data.priority;
      });
  }
}

export function courseToSearchPayload(course: CourseEntry) {
  const d = course.data;
  const category = getCategoryById(d.category);
  const aliases = categorySearchAliases[d.category] ?? [];
  return {
    slug: course.slug,
    title: d.title,
    shortTitle: d.shortTitle ?? '',
    school: d.school ?? '',
    author: d.author ?? '',
    category: d.category,
    categoryName: category?.name ?? '',
    categoryDescription: [
      category?.shortDescription ?? '',
      category?.fullDescription ?? '',
    ].join(' '),
    subcategory: d.subcategory ?? '',
    tags: d.tags,
    shortDescription: d.shortDescription,
    fullDescription: d.fullDescription ?? '',
    categoryAliases: aliases,
    isFree: d.isFree,
    level: d.level,
    isDemo: d.isDemo,
  };
}

export async function getSearchIndex() {
  const courses = preferRealCourses(await getPublicCourses());
  return courses.map(courseToSearchPayload);
}

export function getAffiliateUrl(course: CourseData): string | null {
  if (course.affiliateUrl && course.affiliateUrl.length > 0) {
    return course.affiliateUrl;
  }
  return null;
}

export function formatLevel(level: CourseData['level']): string {
  const map = {
    beginner: 'Для начинающих',
    intermediate: 'Средний уровень',
    advanced: 'Продвинутый уровень',
  };
  return map[level];
}

export function formatFormat(format: CourseData['format']): string {
  const map = {
    video: 'Видеоуроки',
    live: 'Живые занятия',
    mixed: 'Смешанный формат',
    text: 'Текстовые материалы',
    webinar: 'Вебинары',
    'self-paced': 'Самостоятельно',
  };
  return map[format];
}

export function formatCourseType(
  type: NonNullable<CourseData['type']>,
): string {
  const map: Record<NonNullable<CourseData['type']>, string> = {
    profession: 'Профессия',
    skill: 'Навык',
    intensive: 'Интенсив',
    marathon: 'Марафон',
    course: 'Курс',
    masterclass: 'Мастер-класс',
    webinar: 'Вебинар',
    checklist: 'Чек-лист',
    training: 'Тренинг',
    test: 'Тест',
    test_drive: 'Тест-драйв',
    practicum: 'Практикум',
    video_lesson: 'Видеоурок',
    collection: 'Подборка',
  };
  return map[type];
}
