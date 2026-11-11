const ITERATIONS = 100_000;
const encoder = new TextEncoder();
const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
export function randomSecret() { return hex(crypto.getRandomValues(new Uint8Array(32))); }
export async function secretHash(value: string) { return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))); }
async function derive(password: string, salt: Uint8Array<ArrayBuffer>) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS }, key, 256)));
}
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256$${ITERATIONS}$${hex(salt)}$${await derive(password, salt)}`;
}
export async function verifyPassword(password: string, stored: string | null) {
  const match = /^pbkdf2-sha256\$100000\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(stored || "");
  const salt = new Uint8Array((match?.[1] || "0".repeat(32)).match(/../g)!.map(b => parseInt(b, 16)));
  const actual = await derive(password, salt); const expected = match?.[2] || "0".repeat(64);
  let difference = 0; for (let i = 0; i < 64; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return Boolean(match) && difference === 0;
}
