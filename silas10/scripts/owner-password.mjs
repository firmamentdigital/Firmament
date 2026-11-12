// Gera o MASTER_PASSWORD_HASH (senha do login master da gestão) para o .env da VPS.
// Uso: node scripts/owner-password.mjs   (a senha é pedida sem aparecer na tela)
import { webcrypto as crypto } from "node:crypto";
import { createInterface } from "node:readline";

const ITERATIONS = 100_000;
const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");

function ask(question) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: Boolean(process.stdin.isTTY) });
    if (process.stdin.isTTY) rl._writeToOutput = text => { if (text.includes(question)) process.stdout.write(text); };
    rl.question(question, answer => { rl.close(); if (process.stdin.isTTY) process.stdout.write("\n"); resolve(answer); });
  });
}

const password = process.env.OWNER_PASSWORD ?? await ask("Nova senha do login master: ");
if (password.length < 10) { console.error("Use pelo menos 10 caracteres."); process.exit(1); }
if (process.env.OWNER_PASSWORD === undefined && process.stdin.isTTY) {
  const confirmation = await ask("Repita a senha: ");
  if (confirmation !== password) { console.error("As senhas não conferem."); process.exit(1); }
}
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256);
// Separador ":" em vez de "$": arquivos .env (Docker Compose e Wrangler) expandem "$".
console.log(`MASTER_PASSWORD_HASH=${["pbkdf2-sha256", ITERATIONS, hex(salt), hex(new Uint8Array(bits))].join(":")}`);
