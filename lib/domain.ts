import { z } from 'zod';

export const reflectionSchema = z.object({
  satisfaction: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? 4 : Number(v) || 4),
    z.number().int().min(1).max(5)
  ).default(4),
  wentWell: z.preprocess((v) => (v === null || v === undefined ? '' : String(v)), z.string().max(10000)).default(''),
  unexpected: z.preprocess((v) => (v === null || v === undefined ? '' : String(v)), z.string().max(10000)).default(''),
  difficulties: z.preprocess((v) => (v === null || v === undefined ? '' : String(v)), z.string().max(10000)).default(''),
  nextChange: z.preprocess((v) => (v === null || v === undefined ? '' : String(v)), z.string().max(10000)).default(''),
  note: z.preprocess((v) => (v === null || v === undefined ? '' : String(v)), z.string().max(10000)).default(''),
  emotions: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(z.string())).default([]),
  energy: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? 4 : Number(v) || 4),
    z.number().min(1).max(5).optional()
  ).default(4)
});

export const lessonSchema = z.object({
  title: z.string().trim().min(1, '제목을 입력해 주세요.').max(200),
  lessonAt: z.string(),
  subject: z.string().default('국어'),
  grade: z.string().default('2'),
  className: z.preprocess((v) => (v === null || v === undefined ? '' : String(v)), z.string()).default(''),
  unit: z.preprocess((v) => (v === null || v === undefined ? '' : String(v)), z.string()).default(''),
  objective: z.preprocess((v) => (v === null || v === undefined ? '' : String(v)), z.string()).default(''),
  question: z.preprocess((v) => (v === null || v === undefined ? '' : String(v)), z.string()).default(''),
  activities: z.preprocess((v) => (v === null || v === undefined ? '' : String(v)), z.string()).default(''),
  difficulties: z.preprocess((v) => (v === null || v === undefined ? '' : String(v)), z.string()).default(''),
  observations: z.preprocess((v) => (v === null || v === undefined ? '' : String(v)), z.string()).default(''),
  tags: z.preprocess((v) => (v === null || v === undefined ? '' : String(v)), z.string()).default(''),
  status: z.enum(['draft', 'planned', 'reflected']).default('draft'),
  change: z.preprocess((v) => (v === null || v === undefined ? '' : String(v)), z.string()).default(''),
  reason: z.preprocess((v) => (v === null || v === undefined ? '' : String(v)), z.string()).default('')
});

export type Reflection = z.infer<typeof reflectionSchema>;
export type Lesson = z.infer<typeof lessonSchema> & {
  id: string;
  groupId: string;
  version: number;
  parentId?: string;
  reflection?: Reflection;
  analysis?: Analysis;
  editedAnalysis?: Analysis;
  accepted?: boolean;
};

export type Analysis = {
  summary: string;
  strengths: { title: string; explanation: string; evidenceFields: string[] }[];
  improvements: { title: string; explanation: string; evidenceFields: string[] }[];
  nextActions: { action: string; rationale: string }[];
  observationQuestions: string[];
  safetyFlags: string[];
};

export type Profile = {
  displayName: string;
  schoolLevel: string;
  subject: string;
  grade: string;
  aiEnabled: boolean;
};

export function owns(owner: string, user: string) {
  return !!user && owner === user;
}

export function nextVersion(lessons: Lesson[], groupId: string) {
  return Math.max(0, ...lessons.filter((l) => l.groupId === groupId).map((l) => l.version)) + 1;
}

export function recommend(lessons: Lesson[], input: Partial<Lesson>) {
  const words = (s = '') => s.toLowerCase().split(/[\s,]+/).filter((w) => w.length > 1);
  return lessons
    .filter((l) => l.id !== input.id)
    .map((l) => ({
      l,
      score:
        (input.unit && l.unit === input.unit ? 4 : 0) +
        words(input.title).filter((w) => l.title?.toLowerCase().includes(w)).length +
        words(input.tags).filter((w) => words(l.tags).includes(w)).length
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.l);
}
