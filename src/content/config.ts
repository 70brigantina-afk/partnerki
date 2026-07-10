import { defineCollection, z } from 'astro:content';

const courseLevel = z.enum(['beginner', 'intermediate', 'advanced']);
const courseFormat = z.enum([
  'video',
  'live',
  'mixed',
  'text',
  'webinar',
  'self-paced',
]);
const courseType = z.enum([
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
]);
const courseStatus = z.enum(['draft', 'active', 'paused', 'archived']);
const adUseCode = z.enum([
  'manual_check_before_ads',
  'site_only_no_paid_ads',
  'ads_allowed_after_manual_check',
]);

export const courseSchema = z.object({
  id: z.string(),
  title: z.string(),
  shortTitle: z.string().optional(),
  category: z.string(),
  subcategory: z.string().optional(),
  school: z.string().optional(),
  author: z.string().optional(),
  shortDescription: z.string(),
  fullDescription: z.string().optional(),
  type: courseType.optional(),
  isFree: z.boolean().default(false),
  hasFreeTrial: z.boolean().default(false),
  priceText: z.string().optional(),
  level: courseLevel.default('beginner'),
  format: courseFormat.default('video'),
  duration: z.string().optional(),
  audience: z.array(z.string()).default([]),
  learningOutcomes: z.array(z.string()).default([]),
  curriculum: z.array(z.string()).default([]),
  advantages: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
  certificate: z.boolean().default(false),
  feedback: z.boolean().default(false),
  image: z.string().optional(),
  officialUrl: z.string().url().optional().or(z.literal('')),
  affiliateUrl: z.string().url().optional().or(z.literal('')),
  partnerProgram: z.string().optional(),
  tags: z.array(z.string()).default([]),
  featured: z.boolean().default(false),
  recommended: z.boolean().default(false),
  priority: z.number().default(0),
  status: courseStatus.default('draft'),
  checkedAt: z.coerce.date(),
  publishedAt: z.coerce.date().optional(),
  updatedAt: z.coerce.date().optional(),
  seoTitle: z.string(),
  seoDescription: z.string(),
  disclaimer: z
    .string()
    .default(
      'Демонстрационные данные. Реальная программа будет добавлена позже.',
    ),
  isDemo: z.boolean().default(false),
  goals: z
    .array(
      z.enum([
        'profession',
        'income',
        'qualification',
        'self-development',
        'business',
        'child-education',
      ]),
    )
    .default([]),
  durationCategory: z.enum(['short', 'long']).optional(),
  advertiserName: z.string().optional(),
  advertiserINN: z.string().optional(),
  advertiserOKVED: z.string().optional(),
  advertisingContract: z.string().optional(),
  erid: z.string().optional(),
  markingComplete: z.boolean().default(false),
  adUseCode: adUseCode.optional(),
  adUsePolicy: z.string().optional(),
});

export type CourseData = z.infer<typeof courseSchema>;

const courses = defineCollection({
  type: 'content',
  schema: courseSchema,
});

export const collections = { courses };
