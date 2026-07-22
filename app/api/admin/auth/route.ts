import { ADMIN_COOKIE, adminAuthorized, createAdminSession, verifyAdminCredentials } from "@/lib/admin-auth";
import { clean } from "@/lib/voucher-security";

export async function GET(request: Request) {
  return Response.json({ authenticated: await adminAuthorized(request) });
}

export async function POST(request: Request) {
  let body: { username?: unknown; password?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  const username = clean(body.username, 100);
  const password = clean(body.password, 200);
  if (!verifyAdminCredentials(username, password)) return Response.json({ error: "Incorrect username or password." }, { status: 401 });
  const session = await createAdminSession();
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return new Response(JSON.stringify({ authenticated: true }), { status: 200, headers: { "Content-Type": "application/json", "Set-Cookie": `${ADMIN_COOKIE}=${encodeURIComponent(session.token)}; Path=/; HttpOnly; SameSite=Strict; Expires=${session.expires.toUTCString()}${secure}` } });
}

export async function DELETE() {
  return new Response(JSON.stringify({ authenticated: false }), { status: 200, headers: { "Content-Type": "application/json", "Set-Cookie": `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0` } });
}
