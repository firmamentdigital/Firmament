import { redirect } from "next/navigation";
import { readOwnerSession } from "@/lib/owner-auth";

// Hospedagem própria: o login do organizador deixou de usar os cabeçalhos
// injetados pelo ChatGPT Sites (oai-authenticated-*), que poderiam ser forjados
// fora daquela plataforma. A identidade agora vem de uma sessão própria
// (lib/owner-auth.ts). Os nomes das funções foram mantidos para preservar o
// restante do sistema sem alterações.
export type ChatGPTUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const SIGN_IN_PATH = "/gestao/organizador";
const SIGN_OUT_PATH = "/api/owner/logout";

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const session = await readOwnerSession();
  if (!session) return null;
  return { userId: "owner", displayName: "Organização", email: session.email, fullName: null };
}

export async function requireChatGPTUser(returnTo: string): Promise<ChatGPTUser> {
  const user = await getChatGPTUser();
  if (user) return user;
  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string): string {
  return `${SIGN_IN_PATH}?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}

export function chatGPTSignOutPath(returnTo = "/"): string {
  return `${SIGN_OUT_PATH}?return_to=${encodeURIComponent(safeRelativeReturnPath(returnTo))}`;
}

export function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  let url: URL;
  try { url = new URL(value, "https://app.local"); } catch { return "/"; }
  if (url.origin !== "https://app.local") return "/";
  if (url.pathname === SIGN_IN_PATH || url.pathname === SIGN_OUT_PATH) return "/";
  return `${url.pathname}${url.search}${url.hash}`;
}
