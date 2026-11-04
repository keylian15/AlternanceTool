const TZ = 'Europe/Paris';

function parisParts(d: Date) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const p: Record<string, number> = {};
  for (const x of f.formatToParts(d)) if (x.type !== 'literal') p[x.type] = Number(x.value);
  if (p.hour === 24) p.hour = 0;
  return p;
}

/** Convertit une heure locale Paris en instant UTC. */
function parisToUtc(y: number, m: number, d: number, h: number): Date {
  let guess = Date.UTC(y, m - 1, d, h);
  for (let i = 0; i < 2; i++) {
    const p = parisParts(new Date(guess));
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess -= asUtc - Date.UTC(y, m - 1, d, h);
  }
  return new Date(guess);
}

/** Prochain jour ouvré (lendemain, week-end sauté) à 8h, heure de Paris. */
export function nextSendSlot(now = new Date()): Date {
  const p = parisParts(now);
  const base = new Date(Date.UTC(p.year, p.month - 1, p.day));
  do {
    base.setUTCDate(base.getUTCDate() + 1);
  } while (base.getUTCDay() === 0 || base.getUTCDay() === 6);
  return parisToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), 8);
}
