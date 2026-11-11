import { ZodError } from "zod";

export class AppError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export function errorResponse(error: unknown) {
  if (error instanceof ZodError) {
    return json({ error: error.issues[0]?.message || "Revise os campos do formulário.", fields: error.flatten().fieldErrors }, 422);
  }
  if (error instanceof AppError) return json({ error: error.message }, error.status);
  console.error("Event request failed", error instanceof Error ? error.message : "Unknown error");
  return json({ error: "Não foi possível concluir agora. Tente novamente ou fale com Mario Ferrari." }, 500);
}

export function requireSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const originHost = new URL(origin).host;
  if (originHost !== new URL(request.url).host && originHost !== request.headers.get("host")) {
    throw new AppError(403, "Recarregue a página e tente novamente.");
  }
}

export async function readJson(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new AppError(415, "Envie os dados pelo formulário de inscrição.");
  }
  const raw = await request.text();
  if (raw.length > 24_000) throw new AppError(413, "A inscrição excedeu o tamanho permitido.");
  try { return JSON.parse(raw); }
  catch { throw new AppError(400, "Não foi possível ler os dados. Tente novamente."); }
}
