import { env } from "cloudflare:workers";
import { headers } from "next/headers";
import { z } from "zod";
import { AppError } from "./http";
import { isAdminEmail, ownerConfigured } from "./admin-config";
import { randomSecret, secretHash, verifyPassword } from "./guest-password";
import { guestCookieSecure } from "./guest-auth";

// Login do organizador para hospedagem própria (substitui o "Entrar com ChatGPT").
// O e-mail vem de OWNER_EMAIL e a senha é conferida contra OWNER_PASSWORD_HASH,
// gerado por `node scripts/owner-password.mjs`. As sessões ficam em `owner_sessions`
// e caem automaticamente quando o e-mail ou a senha do organizador mudam.
const SESSION_TTL = 8 * 3600;
const WINDOW = 15 * 60;
const PRODUCTION_COOKIE = "__Host-silas_owner";
const LOCAL_COOKIE = "silas_owner_local";
const loginInput = z.object({
  email: z.string().trim().toLowerCase().email("Informe um e-mail válido.").max(254),
  password: z.string().min(1, "Informe a senha.").max(128),
});

// Aceita "pbkdf2-sha256:100000:sal:hash" (formato gerado pelo script, seguro em
// arquivos .env, que expandem "$") e também o formato interno com "$".
function passwordHash() {
  const value = env.OWNER_PASSWORD_HASH?.trim() || "";
  const colon = /^pbkdf2-sha256:100000:([a-f0-9]{32}):([a-f0-9]{64})$/.exec(value);
  return colon ? ["pbkdf2-sha256", "100000", colon[1], colon[2]].join("$") : value;
}
export function ownerLoginConfigured() { return ownerConfigured() && /^pbkdf2-sha256\$100000\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(passwordHash()); }
async function credential() { return secretHash(`${env.OWNER_EMAIL!.trim().toLowerCase()}\n${passwordHash()}`); }
function tokenFromCookie(cookie: string) {
  const production = new RegExp(`(?:^|;\\s*)${PRODUCTION_COOKIE}=([a-f0-9]{64})(?:;|$)`).exec(cookie)?.[1];
  return production || (process.env.NODE_ENV !== "production" ? new RegExp(`(?:^|;\\s*)${LOCAL_COOKIE}=([a-f0-9]{64})(?:;|$)`).exec(cookie)?.[1] : null) || null;
}
function ownerCookie(request: Request, token: string, maxAge: number) {
  const secure = guestCookieSecure(request);
  return `${secure ? PRODUCTION_COOKIE : LOCAL_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

export async function readOwnerSession(): Promise<{ email: string } | null> {
  const token = tokenFromCookie((await headers()).get("cookie") || "");
  if (!token || !env.DB || !ownerLoginConfigured()) return null;
  const row = await env.DB.prepare("SELECT credential FROM owner_sessions WHERE token_hash=? AND expires_at>?")
    .bind(await secretHash(token), Math.floor(Date.now() / 1000)).first<{ credential: string }>();
  if (!row || row.credential !== await credential()) return null;
  return { email: env.OWNER_EMAIL!.trim().toLowerCase() };
}

export async function loginOwner(request: Request, raw: unknown) {
  const input = loginInput.parse(raw);
  if (!env.DB || !ownerLoginConfigured()) throw new AppError(503, "O acesso do organizador ainda não foi configurado no servidor.");
  const db = env.DB; const now = Math.floor(Date.now() / 1000);
  const keys = [{ key: "owner:all", limit: 20 }];
  const ip = request.headers.get("cf-connecting-ip");
  if (ip && /^[a-fA-F0-9.:]{3,64}$/.test(ip)) keys.push({ key: "owner-ip:" + await secretHash(ip), limit: 5 });
  for (const key of keys) {
    const attempts = await db.prepare("SELECT failures, window_started FROM guest_login_attempts WHERE key=?").bind(key.key).first<{ failures: number; window_started: number }>();
    if (attempts && attempts.window_started > now - WINDOW && attempts.failures >= key.limit) throw new AppError(429, "Muitas tentativas. Aguarde 15 minutos e tente novamente.");
  }
  const passwordMatches = await verifyPassword(input.password, passwordHash());
  if (!passwordMatches || !isAdminEmail(input.email)) {
    await db.batch(keys.map(key => db.prepare(`INSERT INTO guest_login_attempts (key, failures, window_started) VALUES (?, 1, ?)
      ON CONFLICT(key) DO UPDATE SET failures=CASE WHEN window_started<=? THEN 1 ELSE failures+1 END,
      window_started=CASE WHEN window_started<=? THEN excluded.window_started ELSE window_started END`).bind(key.key, now, now - WINDOW, now - WINDOW)));
    throw new AppError(401, "E-mail ou senha do organizador inválidos.");
  }
  const token = randomSecret();
  await db.batch([
    db.prepare("DELETE FROM owner_sessions WHERE expires_at<=? OR credential<>?").bind(now, await credential()),
    db.prepare("INSERT INTO owner_sessions (token_hash, credential, created_at, expires_at) VALUES (?, ?, ?, ?)").bind(await secretHash(token), await credential(), now, now + SESSION_TTL),
    ...keys.map(key => db.prepare("DELETE FROM guest_login_attempts WHERE key=?").bind(key.key)),
  ]);
  return { cookie: ownerCookie(request, token, SESSION_TTL) };
}

export async function logoutOwner(request: Request) {
  const token = tokenFromCookie(request.headers.get("cookie") || "");
  if (token && env.DB) await env.DB.prepare("DELETE FROM owner_sessions WHERE token_hash=?").bind(await secretHash(token)).run();
  return ownerCookie(request, "", 0);
}
