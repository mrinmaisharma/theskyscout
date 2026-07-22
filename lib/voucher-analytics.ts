import { clean } from "@/lib/voucher-security";
import type { Connection } from "mysql2/promise";

export const VISITOR_COOKIE = "skyscout_visitor";

type SqlConnection = Pick<Connection, "execute">;

function cookieValue(request: Request, name: string) {
  return request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) || "";
}

export function visitorId(request: Request) {
  const existing = clean(cookieValue(request, VISITOR_COOKIE), 64);
  return /^[a-f0-9-]{36}$/i.test(existing) ? { id: existing, isNew: false } : { id: crypto.randomUUID(), isNew: true };
}

export function visitorCookie(id: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${VISITOR_COOKIE}=${encodeURIComponent(id)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure}`;
}

function firstForwardedIp(value: string | null) {
  return value?.split(",")[0]?.trim() || "";
}

export async function logVoucherEvent(connection: SqlConnection, request: Request, input: { voucherCode: string; eventType: string; visitorId: string; metadata?: Record<string, string | number | boolean> }) {
  const ipAddress = clean(request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || firstForwardedIp(request.headers.get("x-forwarded-for")), 80) || null;
  const userAgent = clean(request.headers.get("user-agent"), 500) || null;
  const acceptLanguage = clean(request.headers.get("accept-language"), 200) || null;
  const referrer = clean(request.headers.get("referer"), 500) || null;
  const country = clean(request.headers.get("cf-ipcountry"), 8) || null;
  const region = clean(request.headers.get("cf-region"), 100) || null;
  const city = clean(request.headers.get("cf-ipcity"), 100) || null;
  const metadata = input.metadata ? JSON.stringify(input.metadata).slice(0, 1000) : null;
  await connection.execute(`INSERT INTO voucher_usage_events (id,voucher_code,event_type,visitor_id,ip_address,user_agent,accept_language,referrer,country,region,city,event_metadata,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [crypto.randomUUID(),input.voucherCode,input.eventType,input.visitorId,ipAddress,userAgent,acceptLanguage,referrer,country,region,city,metadata,new Date().toISOString()]);
}
