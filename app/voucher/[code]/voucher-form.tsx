"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { Voucher } from "@/lib/vouchers";

type Location = { latitude: number; longitude: number; accuracy: number; capturedAt: string };
type Confirmation = { reference: string; emailSent: boolean };
type BookingDetails = { reference: string; voucherCode: string; route: string; travelDate: string; fullName: string; email: string; phone: string; address: string; passportNumber: string; location: { latitude: number; longitude: number; accuracy: number } | null; submittedAt: string; status: string };

export default function VoucherForm({ code }: { code: string }) {
  const [voucher, setVoucher] = useState<Voucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [used, setUsed] = useState(false);
  const [travelDate, setTravelDate] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [location, setLocation] = useState<Location | null>(null);
  const [locationState, setLocationState] = useState<"idle" | "loading" | "denied">("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [details, setDetails] = useState<BookingDetails | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const autoLocationRequested = useRef(false);

  useEffect(() => {
    fetch(`/api/vouchers/${encodeURIComponent(code)}`)
      .then(async (response) => {
        const payload = await response.json() as { voucher?: Voucher; used?: boolean; error?: string };
        if (!response.ok || !payload.voucher) throw new Error(payload.error || "Voucher not found.");
        setVoucher(payload.voucher); setUsed(Boolean(payload.used)); setTravelDate(payload.voucher.travelDates[0] || payload.voucher.defaultTravelDate);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Voucher not found."))
      .finally(() => setLoading(false));
  }, [code]);

  const track = (eventType: string, metadata?: Record<string, string | number | boolean>) => {
    const voucherCode = voucher?.code || code;
    void fetch("/api/vouchers/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voucherCode, eventType, metadata }), keepalive: true }).catch(() => undefined);
  };

  const clearMissing = (field: string) => setMissingFields((current) => current.filter((item) => item !== field));
  const showMissing = (fields: string[]) => {
    setMissingFields([]);
    window.requestAnimationFrame(() => {
      setMissingFields(fields);
      const first = document.querySelector<HTMLElement>(`[data-field="${fields[0]}"] input, [data-field="${fields[0]}"] textarea, [data-field="${fields[0]}"] button`);
      first?.focus(); first?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    const names: Record<string, string> = { travelDate: "travel date", fullName: "full name", email: "email", phone: "phone number", passportNumber: "passport number", address: "home address", location: "location confirmation", privacyConsent: "privacy consent", otp: "email security code" };
    setError(`Please complete: ${fields.map((field) => names[field]).join(", ")}.`);
  };

  const captureLocation = () => {
    setError("");
    if (!navigator.geolocation) { setLocationState("denied"); setError("Location is required, but this browser does not support location access."); return; }
    setLocationState("loading");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coordinates = { latitude: Number(position.coords.latitude.toFixed(6)), longitude: Number(position.coords.longitude.toFixed(6)), accuracy: Math.round(position.coords.accuracy) };
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, capturedAt: new Date().toISOString() });
        setLocationState("idle"); clearMissing("location");
        track("confirm_location", coordinates);
        track("location_confirmed", coordinates);
      },
      () => { setLocationState("denied"); setError("Location permission is required to redeem this voucher. Allow access and try again."); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
    );
  };

  useEffect(() => {
    if (!voucher || used || autoLocationRequested.current) return;
    autoLocationRequested.current = true;
    captureLocation();
  }, [voucher, used]);

  const requestOtp = async (purpose: "redeem" | "view") => {
    setSubmitting(true); setError(""); setMessage("");
    track("otp_requested", { purpose });
    try {
      const response = await fetch("/api/vouchers/otp/request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voucherCode: voucher?.code, email, purpose }) });
      const payload = await response.json() as { challengeId?: string; error?: string };
      if (!response.ok || !payload.challengeId) throw new Error(payload.error || "We could not send the security code.");
      setChallengeId(payload.challengeId); setOtp(""); setMessage(`A six-digit security code was sent to ${email}. It expires in 10 minutes.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "We could not send the security code."); }
    finally { setSubmitting(false); }
  };

  const submitRedemption = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const missing = [
      !travelDate && "travelDate",
      String(form.get("fullName") || "").trim().length < 2 && "fullName",
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && "email",
      String(form.get("phone") || "").trim().length < 7 && "phone",
      String(form.get("passportNumber") || "").trim().length < 5 && "passportNumber",
      String(form.get("address") || "").trim().length < 8 && "address",
      !location && "location",
      form.get("privacyConsent") !== "on" && "privacyConsent",
      Boolean(challengeId) && otp.length !== 6 && "otp",
    ].filter(Boolean) as string[];
    if (missing.length) { showMissing(missing); return; }
    setMissingFields([]); setError("");
    if (!challengeId) { await requestOtp("redeem"); return; }
    setSubmitting(true); setError("");
    track("redeem_submit");
    try {
      const response = await fetch("/api/vouchers/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        voucherCode: voucher?.code, travelDate, fullName: form.get("fullName"), email, phone: form.get("phone"), address: form.get("address"),
        passportNumber: form.get("passportNumber"), privacyConsent: form.get("privacyConsent") === "on", locationConsent: Boolean(location), location, challengeId, otp,
      }) });
      const payload = await response.json() as Confirmation & { error?: string };
      if (!response.ok) throw new Error(payload.error || "We could not submit your request.");
      setConfirmation(payload); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "We could not submit your request."); }
    finally { setSubmitting(false); }
  };

  const viewRequest = async () => {
    setSubmitting(true); setError("");
    track("view_requested");
    try {
      const response = await fetch("/api/vouchers/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ voucherCode: voucher?.code, challengeId, otp }) });
      const payload = await response.json() as { details?: BookingDetails; error?: string };
      if (!response.ok || !payload.details) throw new Error(payload.error || "We could not open this request.");
      setDetails(payload.details);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "We could not open this request."); }
    finally { setSubmitting(false); }
  };

  if (loading) return <main className="voucher-page"><section className="voucher-confirmation"><div className="loading-ring" /><h1>Checking voucher…</h1></section></main>;
  if (!voucher) return <main className="voucher-page"><section className="voucher-confirmation"><p className="voucher-kicker">Invalid voucher</p><h1>We couldn’t find this voucher.</h1><p>{error}</p><a href="/">Return to flight search</a></section></main>;

  if (confirmation) return <main className="voucher-page"><section className="voucher-confirmation"><div className="confirmation-check">✓</div><p className="voucher-kicker">Voucher redeemed</p><h1>Your flight request is confirmed.</h1><p>We received your {voucher.origin.city} to {voucher.destination.city} request. We’ll review the details and send your ticket within 48 hours.</p><div className="confirmation-reference"><span>Reference</span><b>{confirmation.reference}</b></div><p className="confirmation-email-note">{confirmation.emailSent ? "A confirmation email is on its way." : "Your request is saved. Keep this reference."}</p><a href={`/voucher/${voucher.code}`}>View voucher status</a></section></main>;

  const fieldClass = (field: string, base: string) => `${base}${missingFields.includes(field) ? " field-missing" : ""}`;
  return <main className="voucher-page">
    <header className="voucher-header"><a className="brand light" href="/"><span className="brand-mark"><i /><i /><i /></span><span>skyscout</span></a><span>Private early adopter voucher</span></header>
    <section className="voucher-layout">
      <aside className="voucher-summary"><p className="voucher-kicker">{used ? "Voucher used" : "Exclusive voucher"}</p><h1>{used ? "Already redeemed." : "Your journey is on us."}</h1><p>{used ? "Verify the booking email to privately view the submitted request." : "Verify your email and complete your traveller request."}</p><div className="voucher-route"><div><b>{voucher.origin.code}</b><span>{voucher.origin.city}</span></div><div className="voucher-route-line"><span>✈</span></div><div><b>{voucher.destination.code}</b><span>{voucher.destination.city}</span></div></div><div className="voucher-code"><span>Voucher code</span><b>{voucher.code}</b></div><ul><li>Single-use voucher</li><li>Email OTP protected</li><li>Passport encrypted at rest</li></ul></aside>

      {used ? <section className="voucher-form-card used-voucher-card">
        <div className="used-status"><span>✓</span><div><p className="voucher-kicker">Used</p><h2>This voucher has been redeemed</h2><p>For privacy, booking information is visible only after verification through the email used during redemption.</p></div></div>
        {details ? <div className="booking-request-details"><div className="details-head"><span>Verified</span><h3>Booking request</h3></div>{[
          ["Reference", details.reference], ["Status", details.status], ["Route", details.route], ["Travel date", details.travelDate], ["Full name", details.fullName], ["Email", details.email], ["Phone", details.phone], ["Address", details.address], ["Passport number", details.passportNumber], ["Submitted", new Date(details.submittedAt).toLocaleString()],
        ].map(([label, value]) => <div className="detail-row" key={label}><span>{label}</span><b>{value}</b></div>)}{details.location && <div className="detail-row"><span>Location</span><b>{details.location.latitude}, {details.location.longitude}</b></div>}</div> : <div className="used-verify-box"><label className="voucher-field"><span>Booking email</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={Boolean(challengeId)} placeholder="you@example.com" required /></label>{challengeId && <label className="voucher-field otp-field"><span>Six-digit email code</span><input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" /></label>}{message && <div className="otp-message">{message}</div>}{error && <div className="voucher-error" role="alert">{error}</div>}<button className="voucher-submit" type="button" disabled={submitting || !email || (Boolean(challengeId) && otp.length !== 6)} onClick={() => challengeId ? viewRequest() : requestOtp("view")}>{submitting ? "Please wait…" : challengeId ? "Verify and view request" : "Send email code"}<span>→</span></button>{challengeId && <button className="otp-reset" type="button" onClick={() => { setChallengeId(""); setOtp(""); setMessage(""); setError(""); }}>Use another email or resend</button>}</div>}
      </section> : <section className="voucher-form-card"><div className="voucher-form-heading"><span>{challengeId ? "Step 2 of 2" : "Step 1 of 2"}</span><h2>{challengeId ? "Verify and submit" : "Traveller details"}</h2><p>{challengeId ? "Enter the code sent to your email to create the private booking request." : "All required details must belong to the traveller."}</p></div><form onSubmit={submitRedemption} noValidate>
        <div className={fieldClass("travelDate", "voucher-field")} data-field="travelDate"><span>Choose your travel date</span><div className="date-choice-grid">{voucher.travelDates.map((date) => <button key={date} type="button" className={travelDate === date ? "selected" : ""} onClick={() => { setTravelDate(date); clearMissing("travelDate"); track("date_selected", { date }); }}><b>{new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</b><span>{new Date(`${date}T12:00:00`).toLocaleDateString("en-GB", { weekday: "short", year: "numeric" })}</span></button>)}</div><small>Select one of the dates included with this voucher.</small></div>
        <label className={fieldClass("fullName", "voucher-field")} data-field="fullName"><span>Full name</span><input name="fullName" autoComplete="name" placeholder="As shown on your passport" minLength={2} maxLength={100} onChange={() => clearMissing("fullName")} required /></label>
        <div className="voucher-field-row"><label className={fieldClass("email", "voucher-field")} data-field="email"><span>Email</span><input type="email" value={email} onChange={(event) => { setEmail(event.target.value); clearMissing("email"); }} disabled={Boolean(challengeId)} autoComplete="email" placeholder="you@example.com" required /></label><label className={fieldClass("phone", "voucher-field")} data-field="phone"><span>Phone number</span><input name="phone" type="tel" autoComplete="tel" placeholder="Include country code" minLength={7} maxLength={30} onChange={() => clearMissing("phone")} required /></label></div>
        <label className={fieldClass("passportNumber", "voucher-field")} data-field="passportNumber"><span>Passport number</span><input name="passportNumber" type="password" autoComplete="off" placeholder="Enter passport number" minLength={5} maxLength={30} onChange={() => clearMissing("passportNumber")} required /><small>Encrypted before it is stored. Never sent in confirmation emails.</small></label>
        <label className={fieldClass("address", "voucher-field")} data-field="address"><span>Home address</span><textarea name="address" autoComplete="street-address" placeholder="Street, city, region, postal code, country" minLength={8} maxLength={400} onChange={() => clearMissing("address")} required /></label>
        <div className={fieldClass("location", "location-card")} data-field="location"><div><b>Location · Required</b><span>Your browser will ask permission before verifying your address and passport details.</span></div>{location ? <div className="location-success"><span>✓</span><b>Location captured</b><button type="button" onClick={() => setLocation(null)}>Remove</button></div> : <button type="button" onClick={captureLocation} disabled={locationState === "loading"}>{locationState === "loading" ? "Requesting permission…" : "Confirm location"}</button>}</div>
        {challengeId && <label className={fieldClass("otp", "voucher-field otp-field")} data-field="otp"><span>Six-digit email code</span><input value={otp} onChange={(event) => { setOtp(event.target.value.replace(/\D/g, "").slice(0, 6)); clearMissing("otp"); }} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" required /></label>}
        {message && <div className="otp-message">{message}</div>}<label className={fieldClass("privacyConsent", "privacy-check")} data-field="privacyConsent"><input name="privacyConsent" type="checkbox" onChange={() => clearMissing("privacyConsent")} required /><span>I agree that SkyScout may use these details and my required location to process this voucher. Passport data is encrypted before storage.</span></label>{error && <div className="voucher-error" role="alert">{error}</div>}
        <button className="voucher-submit" type="submit" disabled={submitting}>{submitting ? "Please wait…" : challengeId ? "Verify code and submit request" : "Send email security code"}<span>→</span></button>{challengeId && <button className="otp-reset" type="button" onClick={() => { setChallengeId(""); setOtp(""); setMessage(""); setError(""); setMissingFields([]); }}>Change email or request another code</button>}<p className="voucher-fine-print">No payment is taken. The voucher becomes permanently used only after successful email verification and submission.</p>
      </form></section>}
    </section>
  </main>;
}
