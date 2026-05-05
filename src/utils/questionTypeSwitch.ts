import type { Question, QuestionType } from "@/types/fragebogen";
import { defaultConfig } from "@/utils/fragebogen";

function extractImages(config: Record<string, unknown>): string[] {
  const images = config.images;
  if (!Array.isArray(images)) return [];
  return images.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

export function applyQuestionTypeSwitch(question: Question, nextType: QuestionType): Question {
  const images = extractImages(question.config ?? {});
  const nextConfig: Record<string, unknown> = {
    ...defaultConfig(nextType),
  };
  if (images.length > 0) {
    nextConfig.images = images;
  }
  return {
    ...question,
    type: nextType,
    config: nextConfig,
    scoring: {},
  };
}
