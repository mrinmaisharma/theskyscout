import { clean, decryptPassport, mysqlConnection, OtpError, verifyOtpChallenge } from "@/lib/voucher-security";

const dateOnly = (value: unknown) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

export async function POST(request: Request) {
  let body: { voucherCode?: unknown; challengeId?: unknown; otp?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  const voucherCode = clean(body.voucherCode, 80).toUpperCase();
  const challengeId = clean(body.challengeId, 36);
  const otp = clean(body.otp, 6);
  if (!voucherCode || !challengeId || !/^\d{6}$/.test(otp)) return Response.json({ error: "Enter the six-digit security code." }, { status: 400 });

  const connection = await mysqlConnection();
  try {
    await connection.beginTransaction();
    const challenge = await verifyOtpChallenge(connection, { challengeId, otp, voucherCode, purpose: "view" });
    const [rows] = await connection.execute(`SELECT r.*,v.origin_city,v.destination_city FROM voucher_redemptions r
      JOIN vouchers v ON v.code = r.voucher_code WHERE r.voucher_code = ? AND r.email = ? LIMIT 1`, [voucherCode, challenge.email]);
    const record = (rows as Record<string, string | number | null>[])[0];
    if (!record) throw new OtpError("Booking request not found.", 404);
    const passportNumber = record.passport_ciphertext && record.passport_iv ? await decryptPassport(String(record.passport_ciphertext), String(record.passport_iv)) : "Not available";
    await connection.commit();
    return Response.json({ details: {
      reference: record.reference, voucherCode: record.voucher_code, route: `${record.origin_city} → ${record.destination_city}`,
      travelDate: dateOnly(record.travel_date), fullName: record.full_name, email: record.email, phone: record.phone,
      address: record.address, passportNumber, location: record.location_consent ? { latitude: record.latitude, longitude: record.longitude, accuracy: record.location_accuracy } : null,
      submittedAt: record.created_at, status: "Request received",
    } });
  } catch (error) {
    await connection.rollback();
    if (error instanceof OtpError) return Response.json({ error: error.message }, { status: error.status });
    return Response.json({ error: "We could not verify this request." }, { status: 500 });
  } finally { await connection.end(); }
}
