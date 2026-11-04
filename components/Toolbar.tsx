'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Toolbar({ pending }: { pending: number }) {
  const router = useRouter();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  async function scoreLoop() {
    setBusy(true);
    let guard = 0;
    while (guard++ < 60) {
      const r = await fetch('/api/score', { method: 'POST' });
      if (!r.ok) { setMsg('Erreur pendant le scoring'); break; }
      const d = await r.json();
      setMsg(d.remaining > 0 ? `Scoring en cours, ${d.remaining} offres restantes…` : 'Scoring terminé');
      router.refresh();
      if (d.error) { setMsg(d.rateLimited ? 'Quota Gemini atteint, réessaie plus tard' : `Erreur Gemini : ${d.error}`); break; }
      if (d.remaining === 0 || d.scored === 0) break;
      await new Promise((res) => setTimeout(res, 1500));
    }
    setBusy(false);
  }

  async function fetchNow() {
    setBusy(true);
    setMsg('Récupération des offres…');
    const r = await fetch('/api/cron/fetch');
    const d = await r.json().catch(() => null);
    if (!r.ok || !d) setMsg('Erreur pendant la récupération');
    else if (!d.fetched.ok) setMsg(`Erreur : ${d.fetched.error}`);
    else setMsg(`${d.fetched.inserted} nouvelles offres sur ${d.fetched.fetched} récupérées`);
    router.refresh();
    setBusy(false);
  }

  useEffect(() => {
    if (pending > 0 && !started.current) { started.current = true; scoreLoop(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="toolbar">
      <button className="btn" onClick={fetchNow} disabled={busy}>Récupérer les offres</button>
      {pending > 0 && <button className="btn ghost" onClick={scoreLoop} disabled={busy}>Scorer ({pending})</button>}
      {msg && <span className="muted" role="status">{msg}</span>}
    </div>
  );
}
