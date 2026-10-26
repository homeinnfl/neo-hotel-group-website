export function plain(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
    const code = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  }).replace(/&(amp|quot|apos|lt|gt|nbsp);/g, (_, n) => ({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '})[n]).replace(/\s+/g, ' ').trim();
}
export function safeURL(value) {
  try { const u = new URL(value); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''; } catch { return ''; }
}
export function monthRange(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || Number(month.slice(0,4)) < 2020 || Number(month.slice(0,4)) > 2100) throw new Error('Invalid month');
  const [y,m] = month.split('-').map(Number);
  return { start: `${month}-01`, end: `${month}-${new Date(Date.UTC(y,m,0)).getUTCDate()}`, next: new Date(Date.UTC(y,m,1)).toISOString().slice(0,10) };
}
const eastern = new Intl.DateTimeFormat('en-CA', {timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
export function easternWall(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.valueOf())) return '';
  const p = Object.fromEntries(eastern.formatToParts(date).map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}:${p.second}`;
}
export async function getText(url, fetcher = fetch, signal) {
  const response = await fetcher(url, {signal, headers:{Accept:'application/json, text/calendar, application/rss+xml, text/html;q=0.8', 'User-Agent':'NEOHotelGroup-Events/2.0'}});
  if (!response.ok) throw new Error(`Source returned ${response.status}`);
  const body = await response.text();
  if(body.length > 6_000_000) throw new Error('Feed too large');
  return body;
}
export async function getJSON(url, fetcher = fetch, signal) { return JSON.parse(await getText(url,fetcher,signal)); }
