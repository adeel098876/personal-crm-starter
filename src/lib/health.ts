export type HealthInputs = {
  targetCadenceDays: number;
  daysSinceLastInteraction: number | null;
  interactionsLast90Days: number;
  notesCount: number;
  fieldsCount: number;
  promisesKept: number;
  promisesTotal: number;
  hasBirthday: boolean;
  hasAnniversary: boolean;
};

export function computeHealthScore(i: HealthInputs): number {
  let score = 100;
  if (i.daysSinceLastInteraction == null) {
    score -= 40;
  } else {
    const ratio = i.daysSinceLastInteraction / Math.max(7, i.targetCadenceDays);
    if (ratio > 3) score -= 45;
    else if (ratio > 2) score -= 30;
    else if (ratio > 1.5) score -= 20;
    else if (ratio > 1) score -= 10;
  }
  const expected = 90 / Math.max(7, i.targetCadenceDays);
  const cadenceRatio = i.interactionsLast90Days / Math.max(0.5, expected);
  if (cadenceRatio < 0.25) score -= 20;
  else if (cadenceRatio < 0.5) score -= 10;
  else if (cadenceRatio > 1.5) score += 5;
  score += Math.min(10, i.notesCount * 2);
  score += Math.min(8, i.fieldsCount);
  if (i.promisesTotal > 0) {
    const kept = i.promisesKept / i.promisesTotal;
    score += Math.round((kept - 0.5) * 20);
  }
  if (i.hasBirthday) score += 3;
  if (i.hasAnniversary) score += 2;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function healthBand(score: number): "critical" | "weak" | "steady" | "strong" {
  if (score < 30) return "critical";
  if (score < 55) return "weak";
  if (score < 80) return "steady";
  return "strong";
}

export function healthColorClass(score: number): string {
  const band = healthBand(score);
  if (band === "critical") return "text-red-400";
  if (band === "weak") return "text-orange-400";
  if (band === "steady") return "text-amber-300";
  return "text-accent";
}

export function healthBarBgClass(score: number): string {
  const band = healthBand(score);
  if (band === "critical") return "bg-red-400";
  if (band === "weak") return "bg-orange-400";
  if (band === "steady") return "bg-amber-300";
  return "bg-accent";
}
