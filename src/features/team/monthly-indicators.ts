import { type MonthlyFields } from '../../api/modules/team/monthly';
import { type MonthlyReviewState } from '../../api/modules/team/monthly-review';

export function monthlyIndicators(
  metrics: MonthlyFields | null,
  summary: MonthlyReviewState['summary'],
) {
  const absence = metrics
    ? (metrics.absence_medical_hours ?? 0) +
      (metrics.absence_leave_hours ?? 0) +
      (metrics.absence_unjustified_hours ?? 0) +
      (metrics.absence_accident_hours ?? 0)
    : null;
  return {
    active: summary?.active ?? null,
    admissions: summary?.admissions ?? null,
    exits: summary?.exits ?? null,
    net: summary ? summary.admissions - summary.exits : null,
    turnover: summary ? (summary.active ? (summary.exits / summary.active) * 100 : 0) : null,
    moves: summary?.moves ?? null,
    absenteeism:
      metrics?.planned_hours && absence !== null ? (absence / metrics.planned_hours) * 100 : null,
  };
}
