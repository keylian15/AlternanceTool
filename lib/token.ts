const enc = new TextEncoder();

async function hmac(data: string): Promise<string> {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) throw new Error('SESSION_SECRET manquant (16 caractères minimum)');
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function makeToken(): Promise<string> {
  const exp = Date.now() + 30 * 864e5;
  return `${exp}.${await hmac(String(exp))}`;
}

export async function checkToken(t?: string | null): Promise<boolean> {
  if (!t) return false;
  try {
    const [exp, sig] = t.split('.');
    if (!exp || !sig || Number(exp) < Date.now()) return false;
    const expected = await hmac(exp);
    if (expected.length !== sig.length) return false;
    let diff = 0;
    for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}
