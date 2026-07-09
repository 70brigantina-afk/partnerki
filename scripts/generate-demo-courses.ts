import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const categories = [
  'neyroseti',
  'marketing',
  'psihologiya',
  'zdorove',
  'dizayn',
  'angliyskiy',
];

const extraTags: Record<string, string[]> = {
  neyroseti: ['ai', 'automation', 'work'],
  marketing: ['smm', 'business', 'income'],
  psihologiya: ['self-development', 'profession'],
  zdorove: ['nutritsiologiya', 'fitness', 'self-development'],
  dizayn: ['figma', 'marketplace', 'skill'],
  angliyskiy: ['adults', 'children', 'work'],
};

const dir = join(process.cwd(), 'src', 'content', 'courses');
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const today = '2026-07-01';

for (const cat of categories) {
  const templates = [
    {
      num: 1,
      title: 'Демонстрационная программа 1',
      isFree: false,
      hasFreeTrial: false,
      featured: cat === 'neyroseti' || cat === 'marketing',
      recommended: true,
      level: 'beginner',
      type: 'course',
      tags: extraTags[cat],
      goals: ['profession', 'qualification'],
    },
    {
      num: 2,
      title: 'Демонстрационный бесплатный интенсив',
      isFree: true,
      hasFreeTrial: false,
      featured: true,
      recommended: false,
      level: 'beginner',
      type: 'intensive',
      tags: [...extraTags[cat], 'free'],
      goals: ['self-development', 'income'],
    },
    {
      num: 3,
      title: 'Демонстрационный пробный урок',
      isFree: false,
      hasFreeTrial: true,
      featured: false,
      recommended: true,
      level: 'intermediate',
      type: 'skill',
      tags: extraTags[cat],
      goals: ['qualification', 'business'],
    },
  ];

  for (const t of templates) {
    const slug = `demo-${cat}-${t.num}`;
    const content = `---
id: "${slug}"
title: "${t.title}"
shortTitle: "${t.title}"
category: "${cat}"
subcategory: "Демонстрационная подкатегория"
school: "Демонстрационная школа"
author: "Демонстрационный автор"
shortDescription: "Демонстрационные данные. Реальная программа будет добавлена позже. Краткое описание образовательной программы для предпросмотра каталога."
fullDescription: "Демонстрационные данные. Реальная программа будет добавлена позже. Это полное описание демонстрационной записи для проверки шаблона подробной страницы."
type: "${t.type}"
isFree: ${t.isFree}
hasFreeTrial: ${t.hasFreeTrial}
priceText: "Стоимость уточняется на сайте организатора"
level: "${t.level}"
format: "video"
duration: "4-6 недель"
durationCategory: "long"
audience:
  - "Начинающие специалисты"
  - "Те, кто хочет познакомиться с направлением"
learningOutcomes:
  - "Понимание базовых тем направления"
  - "Знакомство с форматом обучения"
curriculum:
  - "Вводный модуль"
  - "Основные темы"
  - "Практические задания"
advantages:
  - "Понятная структура"
  - "Удобный формат"
limitations:
  - "Демонстрационная запись без реальной партнёрской ссылки"
certificate: false
feedback: true
tags: ${JSON.stringify(t.tags)}
featured: ${t.featured}
recommended: ${t.recommended}
priority: ${10 - t.num}
status: "draft"
checkedAt: ${today}
publishedAt: ${today}
updatedAt: ${today}
seoTitle: "${t.title} — демонстрационная запись"
seoDescription: "Демонстрационная карточка обучения. Реальная программа будет добавлена позже."
disclaimer: "Демонстрационные данные. Реальная программа будет добавлена позже."
isDemo: true
goals: ${JSON.stringify(t.goals)}
---

Демонстрационное содержимое программы. Реальные материалы будут добавлены позже.
`;
    writeFileSync(join(dir, `${slug}.md`), content, 'utf-8');
  }
}

console.log('Demo courses generated.');
