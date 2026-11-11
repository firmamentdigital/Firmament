import { requireOwner } from "@/lib/admin";
import { grantMember, listMembers, revokeMember } from "@/lib/access";
import { errorResponse, json, readJson, requireSameOrigin } from "@/lib/http";
export async function GET() {
  try { const user = await requireOwner(); return json({ ownerEmail: user.email, members: await listMembers() }); }
  catch (error) { return errorResponse(error); }
}
export async function POST(request: Request) {
  try { requireSameOrigin(request); const user = await requireOwner(); return json(await grantMember(await readJson(request), user.userId)); }
  catch (error) { return errorResponse(error); }
}
export async function DELETE(request: Request) {
  try { requireSameOrigin(request); await requireOwner(); return json({ members: await revokeMember(await readJson(request)) }); }
  catch (error) { return errorResponse(error); }
}
