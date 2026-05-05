import type { Question } from "@/types/fragebogen";

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function cloneQuestionForModuleInsert(source: Question): Question {
  return {
    ...source,
    config: deepClone(source.config ?? {}),
    rules: deepClone(source.rules ?? []),
    scoring: deepClone(source.scoring ?? {}),
    chains: source.chains ? [...source.chains] : undefined,
  };
}

export function hasQuestionInModule(questions: Question[], questionId: string): boolean {
  return questions.some((question) => question.id === questionId);
}
