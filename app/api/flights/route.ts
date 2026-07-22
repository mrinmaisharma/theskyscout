import { NextResponse } from "next/server";

type Price = { amount?: number; update_status?: string; last_updated?: string; quote_age?: number };
type PricingItem = { agent_id?: string; url?: string; deep_link?: string; price?: Price };
type PricingOption = { agent_ids?: string[]; price?: Price; items?: PricingItem[] };
type Itinerary = { id: string; leg_ids?: string[]; pricing_options?: PricingOption[]; cheapest_price?: Price; score?: number; deep_link?: string };
type Leg = { id: string; departure?: string; arrival?: string; duration?: number; stop_count?: number; segment_ids?: string[]; marketing_carrier_ids?: Array<string | number> };
type Segment = { id: string; marketing_carrier_id?: string | number; marketing_flight_number?: string };
type Carrier = { id: string | number; name?: string; display_code?: string };
type Agent = { id: string; name?: string; rating?: number };
type FlightApiPayload = { itineraries?: Itinerary[]; legs?: Leg[]; segments?: Segment[]; carriers?: Carrier[]; agents?: Agent[]; message?: string; error?: string };

const responseCache = new Map<string, { expires: number; data: unknown }>();
const IATA_PATTERN = /^[A-Z]{3}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const absoluteBookingUrl = (value?: string) => {
  if (!value) return null;
  if (value.startsWith("https://") || value.startsWith("http://")) return value;
  return value.startsWith("/") ? `https://www.skyscanner.co.in${value}` : null;
};

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const departure = requestUrl.searchParams.get("departure")?.toUpperCase() ?? "";
  const arrival = requestUrl.searchParams.get("arrival")?.toUpperCase() ?? "";
  const departureDate = requestUrl.searchParams.get("departureDate") ?? "";
  const returnDate = requestUrl.searchParams.get("returnDate") ?? "";
  const tripType = requestUrl.searchParams.get("tripType") === "oneway" ? "oneway" : "return";
  const adults = Math.min(9, Math.max(1, Number.parseInt(requestUrl.searchParams.get("adults") ?? "1", 10) || 1));
  const latitudeValue = requestUrl.searchParams.get("latitude");
  const longitudeValue = requestUrl.searchParams.get("longitude");
  const latitude = latitudeValue === null ? Number.NaN : Number(latitudeValue);
  const longitude = longitudeValue === null ? Number.NaN : Number(longitudeValue);
  const apiKey = process.env.FLIGHTAPI_KEY;

  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return NextResponse.json({ error: "Confirm your current location before searching for flights." }, { status: 400 });
  }

  if (!IATA_PATTERN.test(departure) || !IATA_PATTERN.test(arrival) || departure === arrival) {
    return NextResponse.json({ error: "Enter two different valid three-letter airport codes." }, { status: 400 });
  }
  if (!DATE_PATTERN.test(departureDate) || (tripType === "return" && !DATE_PATTERN.test(returnDate))) {
    return NextResponse.json({ error: "Choose valid travel dates." }, { status: 400 });
  }
  const today = new Date().toISOString().slice(0, 10);
  if (departureDate < today) {
    return NextResponse.json({ error: "The departure date must be today or later." }, { status: 400 });
  }
  if (tripType === "return" && returnDate <= departureDate) {
    return NextResponse.json({ error: "The return date must be after the departure date." }, { status: 400 });
  }
  if (!apiKey) {
    return NextResponse.json({ error: "FlightAPI.io is not configured yet." }, { status: 503 });
  }

  const currency = "AED";
  const cacheKey = `${tripType}:${departure}:${arrival}:${departureDate}:${returnDate}:${adults}:${currency}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return NextResponse.json(cached.data, { headers: { "Cache-Control": "private, max-age=600" } });

  const pathParts = tripType === "oneway"
    ? ["onewaytrip", apiKey, departure, arrival, departureDate, adults, 0, 0, "Economy", currency]
    : ["roundtrip", apiKey, departure, arrival, departureDate, returnDate, adults, 0, 0, "Economy", currency];
  const upstreamUrl = `https://api.flightapi.io/${pathParts.map((part) => encodeURIComponent(String(part))).join("/")}`;

  try {
    const response = await fetch(upstreamUrl, { headers: { Accept: "application/json" } });
    const body = await response.text();
    let payload: FlightApiPayload;
    try {
      payload = JSON.parse(body) as FlightApiPayload;
    } catch {
      return NextResponse.json({ error: "FlightAPI.io returned an unreadable response." }, { status: 502 });
    }

    if (!response.ok) {
      const quotaMessage = response.status === 429 ? "The FlightAPI.io search quota has been reached." : null;
      return NextResponse.json({ error: quotaMessage ?? payload.message ?? payload.error ?? "Live fares are temporarily unavailable." }, { status: response.status === 429 ? 429 : 502 });
    }

    const legMap = new Map((payload.legs ?? []).map((leg) => [leg.id, leg]));
    const segmentMap = new Map((payload.segments ?? []).map((segment) => [segment.id, segment]));
    const carrierMap = new Map((payload.carriers ?? []).map((carrier) => [String(carrier.id), carrier]));
    const agentMap = new Map((payload.agents ?? []).map((agent) => [agent.id, agent]));

    const flights = (payload.itineraries ?? []).map((itinerary) => {
      const outbound = itinerary.leg_ids?.[0] ? legMap.get(itinerary.leg_ids[0]) : undefined;
      if (!outbound) return null;
      const firstSegment = outbound.segment_ids?.[0] ? segmentMap.get(outbound.segment_ids[0]) : undefined;
      const carrierId = firstSegment?.marketing_carrier_id ?? outbound.marketing_carrier_ids?.[0];
      const carrier = carrierId !== undefined ? carrierMap.get(String(carrierId)) : undefined;
      const pricingOptions = [...(itinerary.pricing_options ?? [])].sort((a, b) => (a.price?.amount ?? Infinity) - (b.price?.amount ?? Infinity));
      const selectedPrice = pricingOptions[0];
      const selectedItem = selectedPrice?.items?.[0];
      const agentId = selectedItem?.agent_id ?? selectedPrice?.agent_ids?.[0];
      const agent = agentId ? agentMap.get(agentId) : undefined;
      const price = itinerary.cheapest_price?.amount ?? selectedPrice?.price?.amount ?? selectedItem?.price?.amount;
      if (!Number.isFinite(price)) return null;
      return {
        id: itinerary.id,
        airline: carrier?.name ?? "Multiple airlines",
        airlineCode: carrier?.display_code ?? "✈",
        flightNumber: `${carrier?.display_code ?? ""}${firstSegment?.marketing_flight_number ?? ""}` || "Multiple flights",
        departure: outbound.departure ?? null,
        arrival: outbound.arrival ?? null,
        durationMinutes: outbound.duration ?? 0,
        stops: outbound.stop_count ?? Math.max(0, (outbound.segment_ids?.length ?? 1) - 1),
        price: Number(price),
        currency,
        provider: agent?.name ?? "Booking partner",
        providerRating: agent?.rating ?? null,
        bookingUrl: absoluteBookingUrl(selectedItem?.deep_link ?? selectedItem?.url ?? itinerary.deep_link),
        quoteAgeMinutes: itinerary.cheapest_price?.quote_age ?? selectedPrice?.price?.quote_age ?? null,
      };
    }).filter((flight): flight is NonNullable<typeof flight> => Boolean(flight));

    const uniqueFlights = Array.from(new Map(flights.map((flight) => [flight.id, flight])).values())
      .sort((a, b) => a.price - b.price)
      .slice(0, 60);
    const fastestId = [...uniqueFlights].sort((a, b) => a.durationMinutes - b.durationMinutes)[0]?.id;
    const taggedFlights = uniqueFlights.map((flight, index) => ({
      ...flight,
      tag: index === 0 ? "Cheapest" : flight.id === fastestId ? "Fastest" : undefined,
    }));
    const result = { flights: taggedFlights, source: "FlightAPI.io", live: true, searchedAt: new Date().toISOString() };
    responseCache.set(cacheKey, { expires: Date.now() + 10 * 60 * 1000, data: result });
    return NextResponse.json(result, { headers: { "Cache-Control": "private, max-age=600" } });
  } catch {
    return NextResponse.json({ error: "Unable to reach FlightAPI.io." }, { status: 502 });
  }
}
