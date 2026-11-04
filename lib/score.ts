import type { Analysis } from './gemini';

const SIZE_BONUS: Record<string, number> = { TPE: 0, PME: 4, ETI: 8, GE: 12, inconnue: 3 };

/** Score final 0-100 : domaine (65 %) + vraies missions (20 %) + bonus taille + bonus filiales étrangères. */
export function computeScore(a: Analysis): number {
  if (a.network_focus) return 0;
  const clamp = (n: unknown) => Math.max(0, Math.min(100, Number(n) || 0));
  const foreign = a.foreign_subsidiaries === true ? 8 : a.foreign_subsidiaries === null ? 2 : 0;
  const raw = 0.65 * clamp(a.domain_match) + 0.2 * clamp(a.missions_match) + (SIZE_BONUS[a.company_size] ?? 3) + foreign;
  return Math.round(Math.min(100, raw));
}
