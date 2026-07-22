import { adminAuthorized } from "@/lib/admin-auth";
import { clean, mysqlConnection } from "@/lib/voucher-security";

export type AdminVoucherInput = {
  code?: unknown; originCity?: unknown; originAirport?: unknown; originCode?: unknown;
  destinationCity?: unknown; destinationAirport?: unknown; destinationCode?: unknown; travelDates?: unknown;
  flightType?: unknown; durationHours?: unknown; carryOnKg?: unknown; checkedBaggageKg?: unknown;
};

export function parseVoucherInput(body: AdminVoucherInput) {
  const code = clean(body.code, 80).toUpperCase();
  const originCity = clean(body.originCity, 100); const originAirport = clean(body.originAirport, 160); const originCode = clean(body.originCode, 3).toUpperCase();
  const destinationCity = clean(body.destinationCity, 100); const destinationAirport = clean(body.destinationAirport, 160); const destinationCode = clean(body.destinationCode, 3).toUpperCase();
  const travelDates = Array.isArray(body.travelDates) ? [...new Set(body.travelDates.map((date) => clean(date, 10)).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort() : [];
  const flightType = clean(body.flightType, 30) || "Direct";
  const durationHours = Number(body.durationHours ?? 9);
  const carryOnKg = Number(body.carryOnKg ?? 7);
  const checkedBaggageKg = Number(body.checkedBaggageKg ?? 25);
  if (!/^[A-Z0-9-]{4,80}$/.test(code) || !originCity || !originAirport || !/^[A-Z]{3}$/.test(originCode) || !destinationCity || !destinationAirport || !/^[A-Z]{3}$/.test(destinationCode) || originCode === destinationCode || travelDates.length === 0 || !Number.isFinite(durationHours) || durationHours <= 0 || durationHours > 40 || !Number.isFinite(carryOnKg) || carryOnKg < 0 || carryOnKg > 100 || !Number.isFinite(checkedBaggageKg) || checkedBaggageKg < 0 || checkedBaggageKg > 100) throw new Error("Complete the route, flight details, and at least one valid travel date.");
  return { code, originCity, originAirport, originCode, destinationCity, destinationAirport, destinationCode, travelDates, flightType, durationMinutes: Math.round(durationHours * 60), carryOnKg: Math.round(carryOnKg), checkedBaggageKg: Math.round(checkedBaggageKg) };
}

export async function GET(request: Request) {
  if (!(await adminAuthorized(request))) return Response.json({ error: "Unauthorized." }, { status: 401 });
  const connection = await mysqlConnection();
  try {
    const [voucherRows] = await connection.execute(`SELECT v.*,r.reference,r.full_name,r.email,
      (SELECT COUNT(*) FROM voucher_usage_events u WHERE u.voucher_code=v.code AND u.event_type='visit') AS visit_count,
      (SELECT COUNT(*) FROM voucher_usage_events u WHERE u.voucher_code=v.code) AS usage_event_count,
      (SELECT u.ip_address FROM voucher_usage_events u WHERE u.voucher_code=v.code ORDER BY u.created_at DESC LIMIT 1) AS last_ip_address,
      (SELECT u.created_at FROM voucher_usage_events u WHERE u.voucher_code=v.code ORDER BY u.created_at DESC LIMIT 1) AS last_seen_at
      FROM vouchers v LEFT JOIN voucher_redemptions r ON r.voucher_code=v.code ORDER BY v.created_at DESC`);
    const [dateRows] = await connection.execute("SELECT voucher_code,travel_date FROM voucher_travel_dates ORDER BY travel_date");
    const dates = new Map<string, string[]>();
    for (const row of dateRows as { voucher_code: string; travel_date: string | Date }[]) {
      const date = row.travel_date instanceof Date ? row.travel_date.toISOString().slice(0, 10) : String(row.travel_date).slice(0, 10);
      dates.set(row.voucher_code, [...(dates.get(row.voucher_code) || []), date]);
    }
    return Response.json({ vouchers: (voucherRows as Record<string, unknown>[]).map((voucher) => ({ ...voucher, travelDates: dates.get(String(voucher.code)) || [] })) });
  } finally { await connection.end(); }
}

export async function POST(request: Request) {
  if (!(await adminAuthorized(request))) return Response.json({ error: "Unauthorized." }, { status: 401 });
  let input: ReturnType<typeof parseVoucherInput>;
  try { input = parseVoucherInput(await request.json() as AdminVoucherInput); } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Invalid voucher." }, { status: 400 }); }
  const connection = await mysqlConnection();
  try {
    await connection.beginTransaction();
    const now = new Date().toISOString();
    const firstTravelDate = input.travelDates[0]!;
    const lastTravelDate = input.travelDates[input.travelDates.length - 1]!;
    await connection.execute(`INSERT INTO vouchers (code,origin_city,origin_airport,origin_code,destination_city,destination_airport,destination_code,flight_type,duration_minutes,carry_on_kg,checked_baggage_kg,default_travel_date,earliest_travel_date,latest_travel_date,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [input.code,input.originCity,input.originAirport,input.originCode,input.destinationCity,input.destinationAirport,input.destinationCode,input.flightType,input.durationMinutes,input.carryOnKg,input.checkedBaggageKg,firstTravelDate,firstTravelDate,lastTravelDate,"active",now]);
    for (const date of input.travelDates) await connection.execute("INSERT INTO voucher_travel_dates (voucher_code,travel_date) VALUES (?,?)", [input.code,date]);
    await connection.commit();
    return Response.json({ created: true, code: input.code }, { status: 201 });
  } catch (error) {
    await connection.rollback();
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    return Response.json({ error: message.includes("duplicate") ? "That voucher code already exists." : "The voucher could not be created." }, { status: message.includes("duplicate") ? 409 : 500 });
  } finally { await connection.end(); }
}
