import { z } from "zod";

export const PlanResponseSchema = z.object({
  planTitle: z.string(),
  days: z.array(
    z.object({
      dayNumber: z.number().int().min(1).max(14),
      missionTitle: z.string(),
      focus: z.string(),
      difficulty: z.union([
        z.number().int().min(1).max(3),
        z.string().transform((val) => parseInt(val, 10))
      ]).pipe(z.number().int().min(1).max(3)),
    })
  ).length(14),
});

export type PlanResponse = z.infer<typeof PlanResponseSchema>;

export const DayMissionResponseSchema = z.object({
  steps: z.array(z.string()).min(5).max(8),
  quiz: z.array(
    z.object({
      q: z.string(),
      type: z.enum(["mcq", "short"]),
      choices: z.array(z.string()).optional(),
      answer: z.string(),
    })
  ).length(3),
});

export type DayMissionResponse = z.infer<typeof DayMissionResponseSchema>;

export const QuizGradeResponseSchema = z.object({
  score: z.number().int().min(0).max(3),
  feedback: z.string(),
  difficultySignal: z.enum(["TOO_EASY", "ON_TRACK", "TOO_HARD"]),
});

export type QuizGradeResponse = z.infer<typeof QuizGradeResponseSchema>;
