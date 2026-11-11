import { env } from "cloudflare:workers";
export function ownerConfigured() { const value = env.OWNER_EMAIL?.trim() || ""; return Boolean(value && !value.includes(",")); }
export function isAdminEmail(email: string) { return ownerConfigured() && env.OWNER_EMAIL!.trim().toLowerCase() === email.trim().toLowerCase(); }
