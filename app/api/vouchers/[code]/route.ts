import { clean, mysqlConnection } from "@/lib/voucher-security";
import { logVoucherEvent, visitorCookie, visitorId } from "@/lib/voucher-analytics";

type VoucherRow = {
  code: string; origin_city: string; origin_airport: string; origin_code: string;
  destination_city: string; destination_airport: string; destination_code: string;
  flight_type: string; duration_minutes: number; carry_on_kg: number; checked_baggage_kg: number;
  default_travel_date: string | Date; earliest_travel_date: string | Date; latest_travel_date: string | Date;
  status: string; reference: string | null;
};

const dateOnly = (value: string | Date) => typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code: rawCode } = await params;
  const code = clean(decodeURIComponent(rawCode), 80).toUpperCase();
  const connection = await mysqlConnection();
  try {
    const [rows] = await connection.execute(`SELECT v.*, r.reference
      FROM vouchers v LEFT JOIN voucher_redemptions r ON r.voucher_code = v.code
      WHERE v.code = ? LIMIT 1`, [code]);
    const voucher = (rows as VoucherRow[])[0];
    if (!voucher) return Response.json({ error: "Voucher not found." }, { status: 404 });
    const [dateRows] = await connection.execute("SELECT travel_date FROM voucher_travel_dates WHERE voucher_code = ? ORDER BY travel_date", [code]);
    const travelDates = (dateRows as { travel_date: string | Date }[]).map((row) => dateOnly(row.travel_date));
    const visitor = visitorId(request);
    try { await logVoucherEvent(connection, request, { voucherCode: code, eventType: "visit", visitorId: visitor.id }); } catch { /* Analytics must not block voucher access. */ }
    return Response.json({
      voucher: {
        code: voucher.code,
        origin: { city: voucher.origin_city, airport: voucher.origin_airport, code: voucher.origin_code },
        destination: { city: voucher.destination_city, airport: voucher.destination_airport, code: voucher.destination_code },
        flightType: voucher.flight_type,
        durationMinutes: Number(voucher.duration_minutes),
        carryOnKg: Number(voucher.carry_on_kg),
        checkedBaggageKg: Number(voucher.checked_baggage_kg),
        defaultTravelDate: dateOnly(voucher.default_travel_date),
        earliestTravelDate: dateOnly(voucher.earliest_travel_date),
        latestTravelDate: dateOnly(voucher.latest_travel_date),
        travelDates,
      },
      used: voucher.status === "redeemed" || Boolean(voucher.reference),
    }, { headers: visitor.isNew ? { "Set-Cookie": visitorCookie(visitor.id) } : undefined });
  } finally { await connection.end(); }
}
