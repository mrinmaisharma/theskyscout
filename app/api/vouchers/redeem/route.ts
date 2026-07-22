import { clean, emailPattern, encryptPassport, mysqlConnection, OtpError, sendConfirmationEmail, verifyOtpChallenge } from "@/lib/voucher-security";

type RedeemBody = {
  voucherCode?: unknown; travelDate?: unknown; fullName?: unknown; email?: unknown; phone?: unknown; address?: unknown;
  passportNumber?: unknown; privacyConsent?: unknown; locationConsent?: unknown; challengeId?: unknown; otp?: unknown;
  location?: { latitude?: unknown; longitude?: unknown; accuracy?: unknown; capturedAt?: unknown } | null;
};

export async function POST(request: Request) {
  let body: RedeemBody;
  try { body = await request.json() as RedeemBody; } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }

  const voucherCode = clean(body.voucherCode, 80).toUpperCase();
  const travelDate = clean(body.travelDate, 10);
  const fullName = clean(body.fullName, 100);
  const email = clean(body.email, 200).toLowerCase();
  const phone = clean(body.phone, 30);
  const address = clean(body.address, 400);
  const passportNumber = clean(body.passportNumber, 30).toUpperCase();
  const challengeId = clean(body.challengeId, 36);
  const otp = clean(body.otp, 6);
  if (!voucherCode || fullName.length < 2 || !emailPattern.test(email) || phone.length < 7 || address.length < 8 || passportNumber.length < 5 || !/^\d{6}$/.test(otp) || !challengeId || body.privacyConsent !== true) {
    return Response.json({ error: "Complete all required fields and enter the six-digit security code." }, { status: 400 });
  }

  const latitude = typeof body.location?.latitude === "number" && body.location.latitude >= -90 && body.location.latitude <= 90 ? body.location.latitude : null;
  const longitude = typeof body.location?.longitude === "number" && body.location.longitude >= -180 && body.location.longitude <= 180 ? body.location.longitude : null;
  const accuracy = typeof body.location?.accuracy === "number" && body.location.accuracy >= 0 ? body.location.accuracy : null;
  const capturedAt = clean(body.location?.capturedAt, 40) || null;
  const hasLocation = body.locationConsent === true && latitude !== null && longitude !== null;
  if (!hasLocation) return Response.json({ error: "Current location is required to redeem this voucher." }, { status: 400 });
  const reference = `SV-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const connection = await mysqlConnection();

  try {
    await connection.beginTransaction();
    const challenge = await verifyOtpChallenge(connection, { challengeId, otp, voucherCode, purpose: "redeem" });
    if (challenge.email.toLowerCase() !== email) throw new OtpError("The verified email does not match this request.", 403);
    const [voucherRows] = await connection.execute("SELECT * FROM vouchers WHERE code = ? FOR UPDATE", [voucherCode]);
    const voucher = (voucherRows as { status: string; earliest_travel_date: string | Date; latest_travel_date: string | Date; origin_city: string; origin_code: string; destination_city: string; destination_code: string }[])[0];
    if (!voucher) throw new OtpError("Voucher not found.", 404);
    if (voucher.status === "redeemed") throw new OtpError("This voucher has already been used.", 409);
    const [dateRows] = await connection.execute("SELECT 1 AS allowed FROM voucher_travel_dates WHERE voucher_code = ? AND travel_date = ? LIMIT 1", [voucherCode, travelDate]);
    if (!(dateRows as { allowed: number }[])[0]) throw new OtpError("Choose one of the travel dates offered by this voucher.");
    const encryptedPassport = await encryptPassport(passportNumber);
    await connection.execute(`INSERT INTO voucher_redemptions (
      id,reference,voucher_code,origin_code,destination_code,travel_date,full_name,email,phone,address,
      latitude,longitude,location_accuracy,location_captured_at,location_consent,privacy_consent,email_status,created_at,
      passport_ciphertext,passport_iv,verified_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
      id, reference, voucherCode, voucher.origin_code, voucher.destination_code, travelDate, fullName, email, phone, address,
      hasLocation ? latitude : null, hasLocation ? longitude : null, hasLocation ? accuracy : null, hasLocation ? capturedAt : null,
      hasLocation ? 1 : 0, 1, "pending", now, encryptedPassport.ciphertext, encryptedPassport.iv, now,
    ]);
    await connection.execute("UPDATE vouchers SET status = 'redeemed', redeemed_at = ? WHERE code = ? AND status = 'active'", [now, voucherCode]);
    await connection.commit();

    const route = `${voucher.origin_city} to ${voucher.destination_city}`;
    const emailSent = await sendConfirmationEmail({ email, fullName, reference, route, travelDate });
    await connection.execute("UPDATE voucher_redemptions SET email_status = ? WHERE id = ?", [emailSent ? "sent" : "not_sent", id]);
    return Response.json({ reference, emailSent }, { status: 201 });
  } catch (error) {
    await connection.rollback();
    if (error instanceof OtpError) return Response.json({ error: error.message }, { status: error.status });
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (message.includes("duplicate")) return Response.json({ error: "This voucher has already been used." }, { status: 409 });
    return Response.json({ error: "We could not securely save your request. Please try again." }, { status: 500 });
  } finally { await connection.end(); }
}
