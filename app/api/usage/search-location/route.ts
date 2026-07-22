import { visitorCookie, visitorId } from "@/lib/voucher-analytics";
import { clean, mysqlConnection } from "@/lib/voucher-security";

type SearchLocationBody = {
  latitude?: unknown;
  longitude?: unknown;
  accuracy?: unknown;
  capturedAt?: unknown;
  departure?: unknown;
  arrival?: unknown;
  departureDate?: unknown;
  returnDate?: unknown;
  tripType?: unknown;
  adults?: unknown;
};

const finiteNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const firstForwardedIp = (value: string | null) => value?.split(",")[0]?.trim() || "";

export async function POST(request: Request) {
  let body: SearchLocationBody;
  try {
    body = await request.json() as SearchLocationBody;
  } catch {
    return Response.json({ error: "Invalid location data." }, { status: 400 });
  }

  const latitude = finiteNumber(body.latitude);
  const longitude = finiteNumber(body.longitude);
  const accuracy = finiteNumber(body.accuracy);
  const capturedAt = clean(body.capturedAt, 40);
  if (latitude === null || latitude < -90 || latitude > 90 || longitude === null || longitude < -180 || longitude > 180 || accuracy === null || accuracy < 0 || !capturedAt) {
    return Response.json({ error: "A valid GPS location is required." }, { status: 400 });
  }

  const visitor = visitorId(request);
  const ipAddress = clean(request.headers.get("x-real-ip") || firstForwardedIp(request.headers.get("x-forwarded-for")) || request.headers.get("cf-connecting-ip"), 80) || null;
  const country = clean(request.headers.get("x-vercel-ip-country") || request.headers.get("cf-ipcountry"), 8) || null;
  const region = clean(request.headers.get("x-vercel-ip-country-region") || request.headers.get("cf-region"), 100) || null;
  const city = clean(request.headers.get("x-vercel-ip-city") || request.headers.get("cf-ipcity"), 100) || null;
  const metadata = JSON.stringify({
    departure: clean(body.departure, 3).toUpperCase(),
    arrival: clean(body.arrival, 3).toUpperCase(),
    departureDate: clean(body.departureDate, 10),
    returnDate: clean(body.returnDate, 10),
    tripType: clean(body.tripType, 10),
    adults: Math.min(9, Math.max(1, Number(body.adults) || 1)),
  });

  const connection = await mysqlConnection();
  try {
    await connection.execute(
      `INSERT INTO site_usage_events (
        id,event_type,visitor_id,latitude,longitude,location_accuracy,location_captured_at,
        ip_address,user_agent,accept_language,referrer,country,region,city,event_metadata,created_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        crypto.randomUUID(), "flight_search_location", visitor.id, latitude, longitude, accuracy, capturedAt,
        ipAddress, clean(request.headers.get("user-agent"), 500) || null,
        clean(request.headers.get("accept-language"), 200) || null,
        clean(request.headers.get("referer"), 500) || null,
        country, region, city, metadata, new Date().toISOString(),
      ],
    );
  } catch {
    return Response.json({ error: "The required location could not be recorded." }, { status: 503 });
  } finally {
    await connection.end();
  }

  return Response.json(
    { logged: true },
    { headers: visitor.isNew ? { "Set-Cookie": visitorCookie(visitor.id) } : undefined },
  );
}
