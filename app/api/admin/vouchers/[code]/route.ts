import { adminAuthorized } from "@/lib/admin-auth";
import { clean, mysqlConnection } from "@/lib/voucher-security";
import { AdminVoucherInput, parseVoucherInput } from "../route";

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!(await adminAuthorized(request))) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const { code: rawCode } = await params;
  const code = clean(decodeURIComponent(rawCode), 80).toUpperCase();
  const connection = await mysqlConnection();
  try {
    const [rows] = await connection.execute(`SELECT event_type,visitor_id,ip_address,user_agent,accept_language,referrer,country,region,city,event_metadata,created_at FROM voucher_usage_events WHERE voucher_code=? ORDER BY created_at DESC LIMIT 100`, [code]);
    return Response.json({ events: rows });
  } finally { await connection.end(); }
}

export async function PUT(request: Request, { params }: { params: Promise<{ code: string }> }) {
  if (!(await adminAuthorized(request))) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const { code: rawCode } = await params;
  const code = clean(decodeURIComponent(rawCode), 80).toUpperCase();
  let input: ReturnType<typeof parseVoucherInput>;
  try { input = parseVoucherInput({ ...(await request.json() as AdminVoucherInput), code }); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid voucher." }, { status: 400 }); }
  const connection = await mysqlConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute("SELECT status FROM vouchers WHERE code = ? FOR UPDATE", [code]);
    const voucher = (rows as { status: string }[])[0];
    if (!voucher) { await connection.rollback(); return Response.json({ error: "Voucher not found." }, { status: 404 }); }
    if (voucher.status === "redeemed") { await connection.rollback(); return Response.json({ error: "A redeemed voucher is locked and cannot be changed." }, { status: 409 }); }
    const firstTravelDate = input.travelDates[0]!;
    const lastTravelDate = input.travelDates[input.travelDates.length - 1]!;
    await connection.execute(`UPDATE vouchers SET origin_city=?,origin_airport=?,origin_code=?,destination_city=?,destination_airport=?,destination_code=?,flight_type=?,duration_minutes=?,carry_on_kg=?,checked_baggage_kg=?,default_travel_date=?,earliest_travel_date=?,latest_travel_date=? WHERE code=?`, [input.originCity,input.originAirport,input.originCode,input.destinationCity,input.destinationAirport,input.destinationCode,input.flightType,input.durationMinutes,input.carryOnKg,input.checkedBaggageKg,firstTravelDate,firstTravelDate,lastTravelDate,code]);
    await connection.execute("DELETE FROM voucher_travel_dates WHERE voucher_code = ?", [code]);
    for (const date of input.travelDates) await connection.execute("INSERT INTO voucher_travel_dates (voucher_code,travel_date) VALUES (?,?)", [code,date]);
    await connection.commit();
    return Response.json({ updated: true });
  } catch {
    await connection.rollback(); return Response.json({ error: "The voucher could not be updated." }, { status: 500 });
  } finally { await connection.end(); }
}
