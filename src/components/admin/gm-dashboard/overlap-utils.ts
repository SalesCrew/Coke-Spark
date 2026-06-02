import {
  findPreviousIntervalId,
  findPreviousYearIntervalId,
  findQuarterPairIntervalId,
  type IppInterval,
} from "@/lib/ipp-dashboard/intervals";
import type { ComparePreset } from "@/components/admin/gm-dashboard/IppOverlapControls";

type ResolveCompareIntervalInput = {
  intervals: IppInterval[];
  baseIntervalId: string | null;
  preset: ComparePreset;
  customCompareIntervalId: string | null;
};

export function resolveCompareIntervalId(input: ResolveCompareIntervalInput): string | null {
  if (!input.baseIntervalId) return null;
  if (input.preset === "previous") {
    return findPreviousIntervalId(input.intervals, input.baseIntervalId);
  }
  if (input.preset === "previous_year") {
    return findPreviousYearIntervalId(input.intervals, input.baseIntervalId) ?? findPreviousIntervalId(input.intervals, input.baseIntervalId);
  }
  if (input.preset === "q4_vs_q2") {
    return findQuarterPairIntervalId(input.intervals, input.baseIntervalId) ?? findPreviousIntervalId(input.intervals, input.baseIntervalId);
  }
  return input.customCompareIntervalId;
}
