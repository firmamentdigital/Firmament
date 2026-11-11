export function registrationCode(value: string): string | null {
  const raw = value.trim();
  if (/^S10-[A-Fa-f0-9]{10}$/.test(raw)) return raw.toUpperCase();
  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol) || url.pathname !== '/gestao') return null;
    const code = url.searchParams.get('inscricao') || '';
    return /^S10-[A-Fa-f0-9]{10}$/.test(code) ? code.toUpperCase() : null;
  } catch { return null; }
}
