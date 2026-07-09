import { getCollection } from 'astro:content';
import type { CollectionEntry } from 'astro:content';
import type { CourseData } from '@/content/config';

export type CourseEntry = CollectionEntry<'courses'>;

export const showDrafts = import.meta.env.DEV
  ? import.meta.env.PUBLIC_SHOW_DRAFTS !== 'false'
  : import.meta.env.PUBLIC_SHOW_DRAFTS === 'true';

export function isPublicCourse(course: CourseData): boolean {
  if (course.status === 'active') return true;
  if (course.status === 'draft' && showDrafts) return true;
  return false;
}

export function isIndexable(course: CourseData): boolean {
  return course.status === 'active';
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
  return courses.filter((c) => c.data.category === categoryId);
}

export function getFeaturedCourses(courses: CourseEntry[]): CourseEntry[] {
  return courses
    .filter((c) => c.data.featured)
    .sort((a, b) => b.data.priority - a.data.priority);
}

export function getRecommendedCourses(courses: CourseEntry[]): CourseEntry[] {
  return courses
    .filter((c) => c.data.recommended)
    .sort((a, b) => b.data.priority - a.data.priority);
}

export function getFreeCourses(courses: CourseEntry[]): CourseEntry[] {
  return courses.filter((c) => c.data.isFree);
}

export function getPaidCourses(courses: CourseEntry[]): CourseEntry[] {
  return courses.filter((c) => !c.data.isFree);
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
  return {
    slug: course.slug,
    title: d.title,
    school: d.school ?? '',
    author: d.author ?? '',
    category: d.category,
    subcategory: d.subcategory ?? '',
    tags: d.tags,
    shortDescription: d.shortDescription,
    isFree: d.isFree,
    level: d.level,
    isDemo: d.isDemo,
  };
}

export async function getSearchIndex() {
  const courses = await getActiveCourses();
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
    advanced: 'Продвинутый',
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
