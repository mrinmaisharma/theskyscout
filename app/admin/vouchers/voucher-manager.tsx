"use client";

import { FormEvent, useEffect, useState } from "react";

type AdminVoucher = {
  code: string; origin_city: string; origin_airport: string; origin_code: string; destination_city: string; destination_airport: string; destination_code: string;
  status: string; created_at: string; redeemed_at: string | null; reference: string | null; full_name: string | null; email: string | null; travelDates: string[];
  visit_count: number; usage_event_count: number; last_ip_address: string | null; last_seen_at: string | null;
  flight_type: string; duration_minutes: number; carry_on_kg: number; checked_baggage_kg: number;
};
type UsageEvent = { event_type: string; visitor_id: string; ip_address: string | null; user_agent: string | null; accept_language: string | null; referrer: string | null; country: string | null; region: string | null; city: string | null; event_metadata: string | null; created_at: string };

const emptyForm = { code: "", originCity: "Manila", originAirport: "Ninoy Aquino International", originCode: "MNL", destinationCity: "Abu Dhabi", destinationAirport: "Zayed International", destinationCode: "AUH", flightType: "Direct", durationHours: "9", carryOnKg: "7", checkedBaggageKg: "25" };

function eventCoordinates(metadata: string | null) {
  if (!metadata) return null;
  try {
    const value = JSON.parse(metadata) as { latitude?: unknown; longitude?: unknown; accuracy?: unknown };
    if (typeof value.latitude !== "number" || typeof value.longitude !== "number") return null;
    return `${value.latitude}, ${value.longitude}${typeof value.accuracy === "number" ? ` · accuracy ±${value.accuracy}m` : ""}`;
  } catch { return null; }
}

export default function AdminVoucherManager() {
  const [vouchers, setVouchers] = useState<AdminVoucher[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [dates, setDates] = useState<string[]>([]);
  const [newDate, setNewDate] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [usageCode, setUsageCode] = useState<string | null>(null);
  const [usageEvents, setUsageEvents] = useState<UsageEvent[]>([]);
  const [usageLoading, setUsageLoading] = useState(false);

  const load = async () => {
    const response = await fetch("/api/admin/vouchers");
    if (response.status === 401) { window.location.assign("/admin/login"); return; }
    const payload = await response.json() as { vouchers?: AdminVoucher[]; error?: string };
    if (!response.ok) throw new Error(payload.error || "Could not load vouchers.");
    setVouchers(payload.vouchers || []); setLoading(false);
  };
  useEffect(() => { load().catch((caught) => { setError(caught instanceof Error ? caught.message : "Could not load vouchers."); setLoading(false); }); }, []);

  const update = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const addDate = () => { if (!newDate || dates.includes(newDate)) return; setDates((current) => [...current, newDate].sort()); setNewDate(""); };
  const reset = () => { setForm(emptyForm); setDates([]); setEditing(null); setError(""); setMessage(""); };
  const edit = (voucher: AdminVoucher) => {
    setEditing(voucher.code); setForm({ code: voucher.code, originCity: voucher.origin_city, originAirport: voucher.origin_airport, originCode: voucher.origin_code, destinationCity: voucher.destination_city, destinationAirport: voucher.destination_airport, destinationCode: voucher.destination_code, flightType: voucher.flight_type, durationHours: String(voucher.duration_minutes / 60), carryOnKg: String(voucher.carry_on_kg), checkedBaggageKg: String(voucher.checked_baggage_kg) }); setDates(voucher.travelDates); setError(""); setMessage(""); window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch(editing ? `/api/admin/vouchers/${encodeURIComponent(editing)}` : "/api/admin/vouchers", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, travelDates: dates }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not save voucher.");
      setMessage(editing ? "Voucher updated." : "Voucher created."); await load(); if (!editing) reset();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save voucher."); }
    finally { setSaving(false); }
  };
  const logout = async () => { await fetch("/api/admin/auth", { method: "DELETE" }); window.location.assign("/admin/login"); };
  const showUsage = async (code: string) => {
    if (usageCode === code) { setUsageCode(null); return; }
    setUsageCode(code); setUsageLoading(true); setUsageEvents([]);
    try {
      const response = await fetch(`/api/admin/vouchers/${encodeURIComponent(code)}`);
      const payload = await response.json() as { events?: UsageEvent[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "Could not load usage.");
      setUsageEvents(payload.events || []);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load usage."); }
    finally { setUsageLoading(false); }
  };

  return <main className="admin-page"><header className="admin-header"><a className="brand light" href="/"><span className="brand-mark"><i /><i /><i /></span><span>skyscout</span></a><div><span>Voucher administration</span><button onClick={logout}>Sign out</button></div></header><section className="admin-shell">
    <section className="admin-editor"><div className="admin-section-title"><div><p className="voucher-kicker">{editing ? "Edit voucher" : "New voucher"}</p><h1>{editing ? editing : "Create a flight voucher"}</h1></div>{editing && <button onClick={reset}>Cancel editing</button>}</div>
      <form onSubmit={save}><label className="voucher-field"><span>Voucher code</span><input value={form.code} onChange={(event) => update("code", event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))} disabled={Boolean(editing)} placeholder="SKYSCOUT-EARLY-002" required /></label>
        <div className="admin-route-grid"><fieldset><legend>Departure</legend><label className="voucher-field"><span>City</span><input value={form.originCity} onChange={(event) => update("originCity", event.target.value)} required /></label><label className="voucher-field"><span>Airport</span><input value={form.originAirport} onChange={(event) => update("originAirport", event.target.value)} required /></label><label className="voucher-field"><span>IATA code</span><input value={form.originCode} maxLength={3} onChange={(event) => update("originCode", event.target.value.toUpperCase())} required /></label></fieldset><fieldset><legend>Destination</legend><label className="voucher-field"><span>City</span><input value={form.destinationCity} onChange={(event) => update("destinationCity", event.target.value)} required /></label><label className="voucher-field"><span>Airport</span><input value={form.destinationAirport} onChange={(event) => update("destinationAirport", event.target.value)} required /></label><label className="voucher-field"><span>IATA code</span><input value={form.destinationCode} maxLength={3} onChange={(event) => update("destinationCode", event.target.value.toUpperCase())} required /></label></fieldset></div>
        <fieldset className="admin-flight-details"><legend>Flight and baggage</legend><label className="voucher-field"><span>Flight type</span><select value={form.flightType} onChange={(event) => update("flightType", event.target.value)}><option>Direct</option><option>1 stop</option><option>2+ stops</option></select></label><label className="voucher-field"><span>Duration (hours)</span><input type="number" min="0.5" max="40" step="0.5" value={form.durationHours} onChange={(event) => update("durationHours", event.target.value)} required /></label><label className="voucher-field"><span>Carry-on (kg)</span><input type="number" min="0" max="100" value={form.carryOnKg} onChange={(event) => update("carryOnKg", event.target.value)} required /></label><label className="voucher-field"><span>Checked baggage (kg)</span><input type="number" min="0" max="100" value={form.checkedBaggageKg} onChange={(event) => update("checkedBaggageKg", event.target.value)} required /></label></fieldset>
        <div className="admin-date-builder"><span>Predefined travel dates</span><div><input type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} /><button type="button" onClick={addDate}>Add date</button></div><div className="admin-date-list">{dates.length ? dates.map((date) => <span key={date}>{new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}<button type="button" aria-label={`Remove ${date}`} onClick={() => setDates((current) => current.filter((item) => item !== date))}>×</button></span>) : <p>Add at least one date customers can choose.</p>}</div></div>
        {error && <div className="voucher-error">{error}</div>}{message && <div className="otp-message">{message}</div>}<button className="voucher-submit" disabled={saving || dates.length === 0}>{saving ? "Saving…" : editing ? "Save voucher changes" : "Create voucher"}<span>→</span></button>
      </form></section>
    <section className="admin-list"><div className="admin-list-head"><div><p className="voucher-kicker">Inventory</p><h2>All vouchers</h2></div><span>{vouchers.length} total</span></div>{loading ? <div className="admin-empty">Loading vouchers…</div> : vouchers.map((voucher) => <article className={`admin-voucher-card ${usageCode === voucher.code ? "usage-open" : ""}`} key={voucher.code}><div className="admin-card-main"><span className={`admin-status ${voucher.status}`}>{voucher.status}</span><h3>{voucher.code}</h3><p>{voucher.origin_code} · {voucher.origin_city} <b>→</b> {voucher.destination_code} · {voucher.destination_city}</p><div className="admin-card-dates">{voucher.travelDates.map((date) => <span key={date}>{new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>)}</div>{voucher.reference && <small>{voucher.reference} · {voucher.full_name} · {voucher.email}</small>}<div className="usage-summary"><span>{voucher.visit_count || 0} visits</span><span>{voucher.usage_event_count || 0} actions</span>{voucher.last_ip_address && <span>Last IP: {voucher.last_ip_address}</span>}</div>{usageCode === voucher.code && <div className="usage-log"><h4>Recent usage</h4>{usageLoading ? <p>Loading…</p> : usageEvents.length ? usageEvents.map((event, index) => <div className="usage-event" key={`${event.created_at}-${index}`}><div><b>{event.event_type.replace(/_/g, " ")}</b><span>{new Date(event.created_at).toLocaleString()}</span></div><p>{event.ip_address || "IP unavailable"} · {event.country || event.region || "Region unavailable"}</p>{eventCoordinates(event.event_metadata) && <strong className="usage-coordinates">Coordinates: {eventCoordinates(event.event_metadata)}</strong>}<small>{event.user_agent || "Browser unavailable"}</small><small>Visitor: {event.visitor_id}</small>{event.referrer && <small>Referrer: {event.referrer}</small>}</div>) : <p>No usage recorded.</p>}</div>}</div><div className="admin-card-actions"><a href={`/voucher/${voucher.code}`} target="_blank" rel="noreferrer">Open</a><button onClick={() => showUsage(voucher.code)}>Usage</button><button onClick={() => edit(voucher)} disabled={voucher.status === "redeemed"}>{voucher.status === "redeemed" ? "Locked" : "Edit"}</button></div></article>)}{!loading && vouchers.length === 0 && <div className="admin-empty">No vouchers yet.</div>}</section>
  </section></main>;
}
