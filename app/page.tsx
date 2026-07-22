"use client";

import { useMemo, useState } from "react";

type Flight = {
  id: string;
  airline: string;
  airlineCode: string;
  flightNumber: string;
  departure: string | null;
  arrival: string | null;
  durationMinutes: number;
  stops: number;
  price: number;
  currency: string;
  provider: string;
  providerRating: number | null;
  bookingUrl: string | null;
  quoteAgeMinutes: number | null;
  tag?: string;
};

const popular = [
  { city: "Cebu", code: "CEB", price: "Explore", color: "sunset" },
  { city: "Dubai", code: "DXB", price: "Explore", color: "coast" },
  { city: "Singapore", code: "SIN", price: "Explore", color: "rio" },
];

const airports = [
  { code: "MNL", city: "Manila", name: "Ninoy Aquino International", country: "Philippines" },
  { code: "AUH", city: "Abu Dhabi", name: "Zayed International", country: "United Arab Emirates" },
  { code: "CEB", city: "Cebu", name: "Mactan-Cebu International", country: "Philippines" },
  { code: "CRK", city: "Clark", name: "Clark International", country: "Philippines" },
  { code: "DVO", city: "Davao", name: "Francisco Bangoy International", country: "Philippines" },
  { code: "DXB", city: "Dubai", name: "Dubai International", country: "United Arab Emirates" },
  { code: "SIN", city: "Singapore", name: "Changi Airport", country: "Singapore" },
  { code: "DEL", city: "Delhi", name: "Indira Gandhi International", country: "India" },
  { code: "BOM", city: "Mumbai", name: "Chhatrapati Shivaji Maharaj International", country: "India" },
  { code: "BLR", city: "Bengaluru", name: "Kempegowda International", country: "India" },
  { code: "MAA", city: "Chennai", name: "Chennai International", country: "India" },
  { code: "HYD", city: "Hyderabad", name: "Rajiv Gandhi International", country: "India" },
  { code: "CCU", city: "Kolkata", name: "Netaji Subhas Chandra Bose International", country: "India" },
  { code: "DOH", city: "Doha", name: "Hamad International", country: "Qatar" },
  { code: "BKK", city: "Bangkok", name: "Suvarnabhumi Airport", country: "Thailand" },
  { code: "HKG", city: "Hong Kong", name: "Hong Kong International", country: "Hong Kong" },
  { code: "NRT", city: "Tokyo", name: "Narita International", country: "Japan" },
  { code: "HND", city: "Tokyo", name: "Haneda Airport", country: "Japan" },
  { code: "ICN", city: "Seoul", name: "Incheon International", country: "South Korea" },
  { code: "KUL", city: "Kuala Lumpur", name: "Kuala Lumpur International", country: "Malaysia" },
  { code: "LHR", city: "London", name: "Heathrow Airport", country: "United Kingdom" },
  { code: "CDG", city: "Paris", name: "Charles de Gaulle", country: "France" },
  { code: "FRA", city: "Frankfurt", name: "Frankfurt Airport", country: "Germany" },
  { code: "MAD", city: "Madrid", name: "Adolfo Suárez Madrid-Barajas", country: "Spain" },
  { code: "JFK", city: "New York", name: "John F. Kennedy International", country: "United States" },
  { code: "LAX", city: "Los Angeles", name: "Los Angeles International", country: "United States" },
  { code: "SFO", city: "San Francisco", name: "San Francisco International", country: "United States" },
  { code: "SYD", city: "Sydney", name: "Sydney Kingsford Smith", country: "Australia" },
  { code: "MEL", city: "Melbourne", name: "Melbourne Airport", country: "Australia" },
  { code: "SCL", city: "Santiago", name: "Arturo Merino Benítez International", country: "Chile" },
];

export default function Home() {
  const [searched, setSearched] = useState(false);
  const [tripType, setTripType] = useState("One way");
  const [from, setFrom] = useState("Manila (MNL)");
  const [to, setTo] = useState("Abu Dhabi (AUH)");
  const [sort, setSort] = useState("best");
  const [departDate, setDepartDate] = useState("2026-08-02");
  const [returnDate, setReturnDate] = useState("2026-09-24");
  const [travellersOpen, setTravellersOpen] = useState(false);
  const [travellers, setTravellers] = useState(1);
  const [notice, setNotice] = useState("");
  const [fareFlights, setFareFlights] = useState<Flight[]>([]);
  const [fareLoading, setFareLoading] = useState(false);
  const [fareError, setFareError] = useState("");
  const [formError, setFormError] = useState("");
  const [activeAirport, setActiveAirport] = useState<"from" | "to" | null>(null);
  const [lastSearchKey, setLastSearchKey] = useState("");
  const [directOnly, setDirectOnly] = useState(false);

  const visibleFlights = useMemo(() => directOnly ? fareFlights.filter((flight) => flight.stops === 0) : fareFlights, [directOnly, fareFlights]);

  const sortedFlights = useMemo(() => {
    if (sort === "cheap") return [...visibleFlights].sort((a, b) => a.price - b.price);
    if (sort === "fast") return [...visibleFlights].sort((a, b) => a.durationMinutes - b.durationMinutes);
    return [...visibleFlights].sort((a, b) => (a.price + a.durationMinutes * 4) - (b.price + b.durationMinutes * 4));
  }, [visibleFlights, sort]);

  const cheapestFlight = visibleFlights.length ? [...visibleFlights].sort((a, b) => a.price - b.price)[0] : null;
  const fastestFlight = visibleFlights.length ? [...visibleFlights].sort((a, b) => a.durationMinutes - b.durationMinutes)[0] : null;
  const bestFlight = sortedFlights[0] ?? null;

  const swapAirports = () => {
    setFrom(to);
    setTo(from);
  };

  const airportCode = (value: string) => {
    const match = value.trim().match(/\(([A-Z]{3})\)$/i) ?? value.trim().match(/^([A-Z]{3})$/i);
    return match?.[1].toUpperCase() ?? "";
  };
  const airportMatches = (query: string) => {
    const term = query.toLowerCase().replace(/[()]/g, " ").trim();
    if (!term) return [];
    return airports.filter((airport) => `${airport.code} ${airport.city} ${airport.name} ${airport.country}`.toLowerCase().includes(term)).slice(0, 6);
  };
  const chooseAirport = (field: "from" | "to", airport: (typeof airports)[number]) => {
    const value = `${airport.city} (${airport.code})`;
    if (field === "from") setFrom(value); else setTo(value);
    setActiveAirport(null);
    setFormError("");
  };
  const formatTime = (value: string | null) => value ? new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) : "—";
  const formatDuration = (minutes: number) => `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  const formatPrice = (flight: Flight | null) => flight ? new Intl.NumberFormat("en-AE", { style: "currency", currency: flight.currency, maximumFractionDigits: 0 }).format(flight.price) : "—";

  const runSearch = async (destinationOverride?: string) => {
    const searchedDestination = destinationOverride ?? to;
    const origin = airportCode(from);
    const destination = airportCode(searchedDestination);
    if (!origin || !destination) {
      setFormError("Choose both airports from the suggestions or enter a valid three-letter IATA code.");
      return;
    }
    if (origin === destination) {
      setFormError("Departure and destination airports must be different.");
      return;
    }
    if (tripType !== "One way" && returnDate <= departDate) {
      setFormError("Choose a return date after the departure date.");
      return;
    }
    const searchKey = `${origin}:${destination}:${departDate}:${tripType === "One way" ? "" : returnDate}:${travellers}:${tripType}:AED`;
    setFormError("");
    setSearched(true);
    setNotice("");
    if (searchKey === lastSearchKey && fareFlights.length > 0) return;
    setFareFlights([]);
    setFareError("");
    setFareLoading(true);
    window.setTimeout(() => document.getElementById("results")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);

    try {
      const params = new URLSearchParams({ departure: origin, arrival: destination, departureDate: departDate, returnDate, tripType: tripType === "One way" ? "oneway" : "return", adults: String(travellers), currency: "AED" });
      const response = await fetch(`/api/flights?${params.toString()}`);
      const payload = await response.json() as { flights?: Flight[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Live fares are unavailable.");
      setFareFlights(payload.flights ?? []);
      setLastSearchKey(searchKey);
    } catch (error) {
      setFareError(error instanceof Error ? error.message : "Live fares are unavailable.");
    } finally {
      setFareLoading(false);
    }
  };

  const openLiveSearch = () => {
    const origin = airportCode(from);
    const destination = airportCode(to);
    const returning = tripType === "One way" ? "" : ` returning ${returnDate}`;
    let url = `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${origin} to ${destination} on ${departDate}${returning}`)}`;

    window.location.assign(url);
  };

  return (
    <main>
      <header className="topbar">
        <div className="nav-wrap">
          <button className="brand" onClick={() => setSearched(false)} aria-label="SkyScout home">
            <span className="brand-mark"><i /><i /><i /></span>
            <span>skyscout</span>
          </button>
          <div className="flight-only-label"><span>✈</span> Flights</div>
          <div className="nav-actions">
            <button className="round-button" aria-label="Choose language and region">CL · EN</button>
            <button className="round-icon" aria-label="Saved flights">♡</button>
            <button className="profile-button"><span>MR</span><b>Log in</b></button>
          </div>
        </div>
      </header>

      {notice && <div className="notice"><span>✓</span>{notice}<button onClick={() => setNotice("")}>×</button></div>}

      <section className={searched ? "hero compact" : "hero"}>
        <div className="hero-inner">
          {!searched && (
            <div className="hero-copy">
              <p className="eyebrow">Your next trip starts here</p>
              <h1>Millions of flights.<br /><span>One simple search.</span></h1>
              <p>Compare trusted airlines and travel sites in seconds, with no hidden fees.</p>
            </div>
          )}

          <div className="search-shell">
            <div className="search-topline">
              <div className="trip-tabs">
                {["One way", "Return"].map((item) => (
                  <button key={item} className={tripType === item ? "selected" : ""} onClick={() => setTripType(item)}>{item}</button>
                ))}
              </div>
              <label className="direct-check"><input type="checkbox" checked={directOnly} onChange={(e) => setDirectOnly(e.target.checked)} /> Direct flights only</label>
            </div>

            <div className="search-grid">
              <div className="search-field location-field">
                <span>From</span>
                <div><b>⌖</b><input value={from} onFocus={() => setActiveAirport("from")} onBlur={() => window.setTimeout(() => setActiveAirport(null), 120)} onChange={(e) => { setFrom(e.target.value); setActiveAirport("from"); setFormError(""); }} aria-label="Departure airport" autoComplete="off" /></div>
                {activeAirport === "from" && <div className="airport-suggestions" role="listbox" aria-label="Departure airport suggestions">
                  {airportMatches(from).map((airport) => <button key={airport.code} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chooseAirport("from", airport)}><span className="airport-code">{airport.code}</span><span><b>{airport.city}</b><small>{airport.name} · {airport.country}</small></span></button>)}
                  {airportMatches(from).length === 0 && <p>No matching airport. You can enter a three-letter IATA code.</p>}
                </div>}
              </div>
              <button className="swap" onClick={swapAirports} aria-label="Swap airports">⇄</button>
              <div className="search-field location-field">
                <span>To</span>
                <div><b>⌖</b><input value={to} onFocus={() => setActiveAirport("to")} onBlur={() => window.setTimeout(() => setActiveAirport(null), 120)} onChange={(e) => { setTo(e.target.value); setActiveAirport("to"); setFormError(""); }} aria-label="Destination airport" autoComplete="off" /></div>
                {activeAirport === "to" && <div className="airport-suggestions" role="listbox" aria-label="Destination airport suggestions">
                  {airportMatches(to).map((airport) => <button key={airport.code} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => chooseAirport("to", airport)}><span className="airport-code">{airport.code}</span><span><b>{airport.city}</b><small>{airport.name} · {airport.country}</small></span></button>)}
                  {airportMatches(to).length === 0 && <p>No matching airport. You can enter a three-letter IATA code.</p>}
                </div>}
              </div>
              <label className="search-field">
                <span>Depart</span>
                <div><b>□</b><input type="date" value={departDate} onChange={(e) => setDepartDate(e.target.value)} aria-label="Departure date" /></div>
              </label>
              <label className="search-field">
                <span>Return</span>
                <div><b>□</b><input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} aria-label="Return date" disabled={tripType === "One way"} /></div>
              </label>
              <div className="search-field traveller-field">
                <span>Travellers and cabin class</span>
                <button onClick={() => setTravellersOpen(!travellersOpen)}><b>♙</b>{travellers} adult{travellers > 1 ? "s" : ""}, Economy <i>⌄</i></button>
                {travellersOpen && (
                  <div className="traveller-popover">
                    <div><span><b>Adults</b><small>Age 16+</small></span><div><button onClick={() => setTravellers(Math.max(1, travellers - 1))}>−</button><b>{travellers}</b><button onClick={() => setTravellers(travellers + 1)}>+</button></div></div>
                    <label>Cabin class<select defaultValue="Economy"><option>Economy</option><option>Premium economy</option><option>Business</option></select></label>
                    <button className="done" onClick={() => setTravellersOpen(false)}>Done</button>
                  </div>
                )}
              </div>
              <button className="search-button" onClick={() => runSearch()} disabled={fareLoading}><span>{fareLoading ? "Searching" : "Search"}</span><b>→</b></button>
            </div>
            {formError && <div className="search-error" role="alert"><span>!</span>{formError}</div>}
          </div>

          {!searched && (
            <div className="trust-row">
              <span><b>✓</b> No booking fees</span><span><b>✓</b> 1,200+ travel partners</span><span><b>✓</b> Price alerts that work</span>
            </div>
          )}
        </div>
      </section>

      {!searched ? (
        <section className="discovery">
          <div className="section-heading"><div><p className="eyebrow dark">Explore from Manila</p><h2>Popular right now</h2></div><button>See everywhere <span>→</span></button></div>
          <div className="destination-grid">
            {popular.map((place) => (
              <button className={`destination-card ${place.color}`} key={place.code} onClick={() => { setTo(`${place.city} (${place.code})`); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                <div className="destination-art"><span className="sun" /><span className="land land-one" /><span className="land land-two" /></div>
                <div><span><b>{place.city}</b><small>MNL → {place.code}</small></span><span><small>route</small><b>{place.price}</b></span></div>
              </button>
            ))}
          </div>
          <div className="confidence-strip">
            <div className="confidence-icon">⌁</div>
            <div><b>Book with confidence</b><span>We search every corner of the web so you don't have to.</span></div>
            <div className="partner-logos"><span>LATAM</span><span>oneworld</span><span>IBERIA</span><span>KLM</span></div>
          </div>
        </section>
      ) : (
        <section className="results-section" id="results">
          <div className="results-head">
            <div><button className="back" onClick={() => setSearched(false)}>←</button><div><p>{from} → {to}</p><span>{tripType} · {departDate}{tripType !== "One way" ? ` – ${returnDate}` : ""} · {travellers} traveller{travellers > 1 ? "s" : ""}</span></div></div>
            <button className="edit-search" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>Edit search</button>
          </div>
          <div className="results-layout">
            <aside className="filters comparison-info">
              <div className="filter-title"><b>Your comparison</b></div>
              <div className="comparison-point"><span>✓</span><div><b>Live prices</b><small>Retrieved for your exact dates</small></div></div>
              <div className="comparison-point"><span>✓</span><div><b>Multiple providers</b><small>Airlines and online travel agents</small></div></div>
              <div className="comparison-point"><span>↗</span><div><b>External checkout</b><small>You book securely with the provider</small></div></div>
              <p>Prices can change until the provider confirms your booking.</p>
            </aside>
            <div className="results-main">
              <section className="live-route-panel" aria-live="polite">
                <div className="live-route-head"><div><span className="live-dot" /><div><b>Live fare search</b><small>Current prices from airlines and booking partners</small></div></div><span className="source-badge">FLIGHTAPI.IO</span></div>
                {fareLoading ? (
                  <div className="live-state"><i className="loading-ring" /><span>Comparing live fares across providers…</span></div>
                ) : fareError ? (
                  <div className="live-state warning"><span>!</span><div><b>We couldn’t load live fares</b><small>{fareError}</small></div></div>
                ) : fareFlights.length === 0 ? (
                  <div className="live-state empty"><span>⌁</span><div><b>No fares found for this search</b><small>Try different dates or another nearby airport.</small></div></div>
                ) : (
                  <div className="fare-success"><span>✓</span><div><b>{fareFlights.length} live options compared</b><small>Prices shown in AED and may change on the provider’s site.</small></div></div>
                )}
              </section>
              {!fareLoading && fareFlights.length > 0 && visibleFlights.length === 0 && <div className="no-direct-results"><b>No direct flights found</b><span>Turn off “Direct flights only” to see connecting options from this same search—no extra API credits needed.</span></div>}
              {!fareLoading && visibleFlights.length > 0 && <>
              <div className="result-toolbar"><div><h2>{visibleFlights.length} flight options</h2><span>Live prices · Continue on the selected provider</span></div><label>Sort by<select value={sort} onChange={(e) => setSort(e.target.value)}><option value="best">Best</option><option value="cheap">Cheapest</option><option value="fast">Fastest</option></select></label></div>
              <div className="sort-tabs">
                <button className={sort === "best" ? "active" : ""} onClick={() => setSort("best")}><b>Best</b><span>{formatPrice(bestFlight)} · {bestFlight ? formatDuration(bestFlight.durationMinutes) : "—"}</span></button>
                <button className={sort === "cheap" ? "active" : ""} onClick={() => setSort("cheap")}><b>Cheapest</b><span>{formatPrice(cheapestFlight)} · {cheapestFlight ? formatDuration(cheapestFlight.durationMinutes) : "—"}</span></button>
                <button className={sort === "fast" ? "active" : ""} onClick={() => setSort("fast")}><b>Fastest</b><span>{formatPrice(fastestFlight)} · {fastestFlight ? formatDuration(fastestFlight.durationMinutes) : "—"}</span></button>
              </div>
              <div className="flight-list">
                {sortedFlights.slice(0, 30).map((flight) => (
                  <article className="flight-card" key={flight.id}>
                    {flight.tag && <span className={`flight-tag ${flight.tag.toLowerCase()}`}>{flight.tag}</span>}
                    <div className="flight-info">
                      <div className="airline"><span className="airline-logo api-logo">{flight.airlineCode}</span><div><b>{flight.airline}</b><span>{flight.flightNumber}</span></div></div>
                      <div className="flight-times">
                        <div><b>{formatTime(flight.departure)}</b><span>{airportCode(from)}</span></div>
                        <div className="route-line"><span>{formatDuration(flight.durationMinutes)}</span><i /><small className={flight.stops === 0 ? "direct" : "one-stop"}>{flight.stops === 0 ? "Direct" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`}</small></div>
                        <div><b>{formatTime(flight.arrival)}</b><span>{airportCode(to)}</span></div>
                      </div>
                      <div className="flight-meta"><span>Live fare from {flight.provider}</span><span className="green">✓ Price checked recently</span></div>
                    </div>
                    <div className="flight-price"><button className="heart" aria-label={`Save ${flight.airline} flight`}>♡</button><span>{travellers} traveller{travellers > 1 ? "s" : ""}</span><b>{formatPrice(flight)}</b><small>via {flight.provider}</small><button onClick={() => flight.bookingUrl ? window.location.assign(flight.bookingUrl) : openLiveSearch()}>View deal <span>↗</span></button></div>
                  </article>
                ))}
              </div>
              </>}
            </div>
          </div>
        </section>
      )}

      <footer><div className="footer-inner"><div className="brand light"><span className="brand-mark"><i /><i /><i /></span><span>skyscout</span></div><p>Travel made simple. Live prices shown in AED.</p><div><a href="#">Privacy</a><a href="#">Terms</a><a href="#">Help</a></div></div></footer>

    </main>
  );
}
