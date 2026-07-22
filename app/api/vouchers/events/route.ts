import { logVoucherEvent, visitorCookie, visitorId } from "@/lib/voucher-analytics";
import { clean, mysqlConnection } from "@/lib/voucher-security";

const allowedEvents = new Set(["date_selected", "confirm_location", "location_confirmed", "otp_requested", "redeem_submit", "view_requested"]);

export async function POST(request: Request) {
  let body: { voucherCode?: unknown; eventType?: unknown; metadata?: unknown };
  try { body = await request.json(); } catch { return new Response(null, { status: 204 }); }
  const voucherCode = clean(body.voucherCode, 80).toUpperCase();
  const eventType = clean(body.eventType, 60);
  if (!voucherCode || !allowedEvents.has(eventType)) return new Response(null, { status: 204 });
  const metadata = body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata) ? body.metadata as Record<string, string | number | boolean> : undefined;
  const visitor = visitorId(request);
  const connection = await mysqlConnection();
  try {
    const [rows] = await connection.execute("SELECT 1 AS found FROM vouchers WHERE code = ? LIMIT 1", [voucherCode]);
    if ((rows as { found: number }[])[0]) await logVoucherEvent(connection, request, { voucherCode, eventType, visitorId: visitor.id, metadata });
  } catch { /* Usage logging is intentionally non-blocking. */ }
  finally { await connection.end(); }
  return new Response(null, { status: 204, headers: visitor.isNew ? { "Set-Cookie": visitorCookie(visitor.id) } : undefined });
}
