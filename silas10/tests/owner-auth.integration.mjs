// Testes do login próprio do organizador (hospedagem na VPS, sem ChatGPT Sites).
// Uso: node tests/owner-auth.integration.mjs
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { webcrypto } from 'node:crypto';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = resolve(root, 'work/owner-auth-test'); await mkdir(work, { recursive: true });
const sqlite = new DatabaseSync(':memory:'); sqlite.exec('PRAGMA foreign_keys=ON');
for (const file of (await readdir(resolve(root, 'drizzle'))).filter(f => f.endsWith('.sql')).sort()) sqlite.exec(await readFile(resolve(root, 'drizzle', file), 'utf8'));
function statement(sql, args = []) {
  const prepared = sqlite.prepare(sql);
  return {
    bind(...values) { return statement(sql, values); },
    async first() { return prepared.get(...args) || null; },
    async all() { return { results: prepared.all(...args), meta: { changes: 0 }, success: true }; },
    async run() { const r = prepared.run(...args); return { results: [], meta: { changes: Number(r.changes) }, success: true }; },
    exec() { const r = prepared.run(...args); return { results: [], meta: { changes: Number(r.changes) }, success: true }; },
  };
}
const DB = { prepare: statement, async batch(list) { sqlite.exec('BEGIN'); try { const r = list.map(s => s.exec()); sqlite.exec('COMMIT'); return r; } catch (e) { sqlite.exec('ROLLBACK'); throw e; } } };

async function hashFor(password) {
  const hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const key = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await webcrypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return ['pbkdf2-sha256', 100000, hex(salt), hex(new Uint8Array(bits))].join(':');
}

globalThis.__ownerEnv = { DB, OWNER_EMAIL: 'dono@example.test', OWNER_PASSWORD_HASH: '' };
globalThis.__ownerHeaders = new Headers();
const entry = `export * as auth from './app/chatgpt-auth';
export * as ownerAuth from './lib/owner-auth';
export {requireAdmin} from './lib/admin';
export * as loginRoute from './app/api/owner/login/route';
export * as logoutRoute from './app/api/owner/logout/route';`;
await build({
  stdin: { contents: entry, resolveDir: root, loader: 'ts' }, absWorkingDir: root, bundle: true, platform: 'node', format: 'esm', packages: 'external',
  outfile: resolve(work, 'server.mjs'), tsconfig: resolve(root, 'tsconfig.json'), define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'fixtures', setup(b) {
    b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'env', namespace: 'fixture' }));
    b.onResolve({ filter: /^next\/headers$/ }, () => ({ path: 'headers', namespace: 'fixture' }));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents: {
      env: 'export const env=globalThis.__ownerEnv;',
      headers: 'export async function headers(){return globalThis.__ownerHeaders;}',
      navigation: 'export function redirect(to){const e=new Error("REDIRECT");e.to=to;throw e;}',
    }[args.path] }));
  } }],
});
const app = await import(pathToFileURL(resolve(work, 'server.mjs')).href + '?' + Date.now());

let checks = 0; const check = (value, message) => { assert.ok(value, message); checks++; };
const ORIGIN = 'https://inscricoes.example.test';
const login = (body, ip = '203.0.113.10') => app.loginRoute.POST(new Request(ORIGIN + '/api/owner/login', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': ip }, body: JSON.stringify(body) }));
const cookieOf = response => /__Host-silas_owner=([a-f0-9]{64})/.exec(response.headers.get('set-cookie') || '')?.[0] || '';
const asVisitor = (cookie = '', extra = {}) => { globalThis.__ownerHeaders = new Headers({ cookie, ...extra }); };
const good = { email: 'dono@example.test', password: 'Senha-Forte-2026' };

// 1. Sem senha configurada: login fechado.
check((await login(good)).status === 503, 'Login do organizador fica fechado sem OWNER_PASSWORD_HASH');

globalThis.__ownerEnv.OWNER_PASSWORD_HASH = await hashFor(good.password);
check(app.ownerAuth.ownerLoginConfigured(), 'Hash no formato com ":" é aceito');

// 2. Credenciais erradas.
check((await login({ ...good, password: 'errada' })).status === 401, 'Senha errada é recusada');
check((await login({ ...good, email: 'outro@example.test' })).status === 401, 'E-mail diferente do OWNER_EMAIL é recusado');
const noOrigin = await app.loginRoute.POST(new Request(ORIGIN + '/api/owner/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(good) }));
check(noOrigin.status === 403, 'Login sem cabeçalho Origin é recusado');
const crossSite = await app.loginRoute.POST(new Request(ORIGIN + '/api/owner/login', { method: 'POST', headers: { Origin: 'https://evil.example', 'Content-Type': 'application/json' }, body: JSON.stringify(good) }));
check(crossSite.status === 403, 'Login vindo de outro site é recusado');

// 3. Cabeçalhos do ChatGPT Sites forjados não dão acesso.
asVisitor('', { 'oai-authenticated-user-id': 'forjado', 'oai-authenticated-user-email': good.email });
check(await app.auth.getChatGPTUser() === null, 'Cabeçalhos oai-authenticated-* são ignorados');
await assert.rejects(() => app.requireAdmin(), e => e.status === 401); checks++;

// 4. Login correto cria sessão de proprietário.
const ok = await login({ ...good, email: '  DONO@example.test ' });
check(ok.status === 200, 'Credenciais corretas entram (e-mail sem diferenciar maiúsculas)');
const setCookie = ok.headers.get('set-cookie');
check(/HttpOnly/.test(setCookie) && /Secure/.test(setCookie) && /SameSite=Lax/.test(setCookie) && /Path=\//.test(setCookie), 'Cookie é HttpOnly, Secure e SameSite');
const cookie = cookieOf(ok);
asVisitor(cookie);
const user = await app.auth.getChatGPTUser();
check(user?.email === good.email && user.userId === 'owner', 'Sessão identifica o organizador');
const admin = await app.requireAdmin();
check(admin.role === 'owner', 'Organizador recebe papel de proprietário na gestão');
asVisitor(cookie.replace(/.$/, c => c === '0' ? '1' : '0'));
check(await app.auth.getChatGPTUser() === null, 'Token adulterado não vale');

// 5. Trocar a senha derruba as sessões antigas.
asVisitor(cookie);
globalThis.__ownerEnv.OWNER_PASSWORD_HASH = await hashFor('Outra-Senha-2026');
check(await app.auth.getChatGPTUser() === null, 'Troca de senha invalida sessões abertas');
check((await login(good)).status === 401, 'Senha antiga deixa de funcionar');
globalThis.__ownerEnv.OWNER_PASSWORD_HASH = await hashFor(good.password);

// 6. Logout.
const fresh = cookieOf(await login(good));
const out = await app.logoutRoute.GET(new Request(ORIGIN + '/api/owner/logout?return_to=/gestao', { headers: { cookie: fresh } }));
check(out.status === 303 && out.headers.get('location') === '/gestao' && /Max-Age=0/.test(out.headers.get('set-cookie')), 'Logout apaga o cookie e volta à gestão');
asVisitor(fresh);
check(await app.auth.getChatGPTUser() === null, 'Sessão encerrada deixa de valer');

// 7. Redirecionamentos só para o próprio site.
for (const bad of ['//evil.example', 'https://evil.example', '/\\evil.example', 'gestao', '/api/owner/logout'])
  check(app.auth.safeRelativeReturnPath(bad) === '/', 'Bloqueia redirecionamento inseguro: ' + bad);
check(app.auth.safeRelativeReturnPath('/gestao?inscricao=S10-ABCDEF1234') === '/gestao?inscricao=S10-ABCDEF1234', 'Mantém retorno para a gestão com código da família');
check(app.auth.chatGPTSignInPath('/gestao').startsWith('/gestao/organizador?return_to='), 'Link de login aponta para a tela do organizador');

// 8. Troca do e-mail do organizador no .env.
const before = cookieOf(await login(good));
asVisitor(before); check((await app.requireAdmin()).role === 'owner', 'Proprietário vinculado ao e-mail original');
globalThis.__ownerEnv.OWNER_EMAIL = 'novo-dono@example.test';
check(await app.auth.getChatGPTUser() === null, 'Trocar OWNER_EMAIL derruba as sessões do e-mail antigo');
check((await login(good)).status === 401, 'E-mail antigo deixa de entrar');
asVisitor(cookieOf(await login({ ...good, email: 'novo-dono@example.test' })));
const moved = await app.requireAdmin();
check(moved.role === 'owner' && moved.email === 'novo-dono@example.test', 'Novo e-mail vira proprietário sem mexer no banco');
check(sqlite.prepare("SELECT email FROM owner_identity WHERE key='owner'").get().email === 'novo-dono@example.test', 'Vínculo do proprietário atualizado');
globalThis.__ownerEnv.OWNER_EMAIL = good.email;

// 9. Limite de tentativas.
for (let i = 0; i < 5; i++) await login({ ...good, password: 'x' + i }, '198.51.100.7');
check((await login(good, '198.51.100.7')).status === 429, 'Bloqueia o IP após 5 erros em 15 minutos');
check((await login(good, '198.51.100.8')).status === 200, 'Outro IP continua entrando');

console.log(JSON.stringify({ passed: checks }));
