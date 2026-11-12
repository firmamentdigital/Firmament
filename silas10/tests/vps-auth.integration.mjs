// Testes dos ajustes de autenticação para a VPS (hospedagem fora do ChatGPT Sites).
// Uso: node tests/vps-auth.integration.mjs
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { webcrypto } from 'node:crypto';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = resolve(root, 'work/vps-auth-test'); await mkdir(work, { recursive: true });
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

async function hashFor(password, separator) {
  const hex = b => Array.from(b, x => x.toString(16).padStart(2, '0')).join('');
  const salt = webcrypto.getRandomValues(new Uint8Array(16));
  const key = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await webcrypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);
  return ['pbkdf2-sha256', 100000, hex(salt), hex(new Uint8Array(bits))].join(separator);
}

globalThis.__vpsEnv = { DB, OWNER_EMAIL: 'dono@example.test', MASTER_LOGIN: 'organizador', MASTER_PASSWORD_HASH: '' };
globalThis.__vpsHeaders = new Headers();
await build({
  stdin: { contents: `export * as auth from './app/chatgpt-auth';\nexport * as master from './lib/master-auth';\nexport {requireAdmin} from './lib/admin';\nexport * as loginRoute from './app/api/master/login/route';`, resolveDir: root, loader: 'ts' },
  absWorkingDir: root, bundle: true, platform: 'node', format: 'esm', packages: 'external',
  outfile: resolve(work, 'server.mjs'), tsconfig: resolve(root, 'tsconfig.json'), define: { 'process.env.NODE_ENV': '"production"' },
  plugins: [{ name: 'fixtures', setup(b) {
    b.onResolve({ filter: /^cloudflare:workers$/ }, () => ({ path: 'env', namespace: 'fixture' }));
    b.onResolve({ filter: /^next\/headers$/ }, () => ({ path: 'headers', namespace: 'fixture' }));
    b.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'fixture' }));
    b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'js', contents: {
      env: 'export const env=globalThis.__vpsEnv;',
      headers: 'export async function headers(){return globalThis.__vpsHeaders;}',
      navigation: 'export function redirect(to){const e=new Error("REDIRECT");e.to=to;throw e;}',
    }[args.path] }));
  } }],
});
const app = await import(pathToFileURL(resolve(work, 'server.mjs')).href + '?' + Date.now());

let checks = 0; const check = (value, message) => { assert.ok(value, message); checks++; };
const ORIGIN = 'https://silas10.example.test';
const login = body => app.loginRoute.POST(new Request(ORIGIN + '/api/master/login', { method: 'POST', headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9' }, body: JSON.stringify(body) }));
const cookieOf = r => /__Host-silas_master=[a-f0-9]{64}/.exec(r.headers.get('set-cookie') || '')?.[0] || '';
const forged = { 'oai-authenticated-user-id': 'forjado', 'oai-authenticated-user-email': 'dono@example.test' };

// 1. Cabeçalhos do ChatGPT Sites forjados não dão acesso, nem sem login master configurado.
globalThis.__vpsHeaders = new Headers(forged);
check(await app.auth.getChatGPTUser() === null, 'Cabeçalhos oai-authenticated-* são ignorados');
check(!app.master.masterConfigured(), 'Sem hash, login master fica desligado');
await assert.rejects(() => app.requireAdmin(), e => e.status === 401); checks++;

// 2. Hash no formato ":" (seguro para .env) funciona.
globalThis.__vpsEnv.MASTER_PASSWORD_HASH = await hashFor('Senha-Forte-2026', ':');
check(app.master.masterConfigured(), 'Hash com ":" é aceito');
check((await login({ login: 'organizador', password: 'errada' })).status === 401, 'Senha errada é recusada');
const ok = await login({ login: 'Organizador', password: 'Senha-Forte-2026' });
check(ok.status === 200, 'Login master entra com hash ":"');
globalThis.__vpsHeaders = new Headers({ cookie: cookieOf(ok) });
const admin = await app.requireAdmin();
check(admin.role === 'owner' && admin.authMethod === 'master', 'Login master vira proprietário da gestão');

// 3. Formato original com "$" continua aceito.
globalThis.__vpsEnv.MASTER_PASSWORD_HASH = await hashFor('Outra-Senha-2026', '$');
check(app.master.masterConfigured(), 'Hash original com "$" continua aceito');
check(await app.master.readMasterSession() === null, 'Trocar a senha derruba as sessões abertas');
check((await login({ login: 'organizador', password: 'Outra-Senha-2026' })).status === 200, 'Login com hash "$" funciona');

// 4. Hash inválido não liga o acesso.
globalThis.__vpsEnv.MASTER_PASSWORD_HASH = 'pbkdf2-sha256:100000:curto:curto';
check(!app.master.masterConfigured(), 'Hash malformado mantém o login master desligado');

console.log(JSON.stringify({ passed: checks }));
