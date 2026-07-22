import { clean, emailPattern, generateOtp, hashOtp, mysqlConnection, sendOtpEmail } from "@/lib/voucher-security";

export async function POST(request: Request) {
  let body: { voucherCode?: unknown; email?: unknown; purpose?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid request." }, { status: 400 }); }
  const voucherCode = clean(body.voucherCode, 80).toUpperCase();
  const email = clean(body.email, 200).toLowerCase();
  const purpose = body.purpose === "view" ? "view" : "redeem";
  if (!voucherCode || !emailPattern.test(email)) return Response.json({ error: "Enter a valid email address." }, { status: 400 });

  const connection = await mysqlConnection();
  try {
    const [voucherRows] = await connection.execute("SELECT status FROM vouchers WHERE code = ? LIMIT 1", [voucherCode]);
    const voucher = (voucherRows as { status: string }[])[0];
    if (!voucher) return Response.json({ error: "Voucher not found." }, { status: 404 });
    if (purpose === "redeem" && voucher.status === "redeemed") return Response.json({ error: "This voucher has already been used." }, { status: 409 });

    if (purpose === "view") {
      const [redemptionRows] = await connection.execute("SELECT email FROM voucher_redemptions WHERE voucher_code = ? LIMIT 1", [voucherCode]);
      const redemption = (redemptionRows as { email: string }[])[0];
      if (!redemption || redemption.email.toLowerCase() !== email) return Response.json({ error: "The email does not match this voucher." }, { status: 403 });
    }

    const since = new Date(Date.now() - 15 * 60_000).toISOString();
    const [rateRows] = await connection.execute("SELECT COUNT(*) AS count FROM voucher_otp_challenges WHERE email = ? AND created_at >= ?", [email, since]);
    if (Number((rateRows as { count: number }[])[0]?.count ?? 0) >= 5) return Response.json({ error: "Too many codes requested. Try again in 15 minutes." }, { status: 429 });

    const challengeId = crypto.randomUUID();
    const otp = generateOtp();
    const otpHash = await hashOtp(challengeId, otp);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();
    await connection.execute("INSERT INTO voucher_otp_challenges (id,voucher_code,email,purpose,otp_hash,expires_at,attempts,created_at) VALUES (?,?,?,?,?,?,0,?)", [challengeId, voucherCode, email, purpose, otpHash, expiresAt, now.toISOString()]);
    const sent = await sendOtpEmail(email, otp, purpose);
    if (!sent) {
      await connection.execute("DELETE FROM voucher_otp_challenges WHERE id = ?", [challengeId]);
      return Response.json({ error: "We could not send the security code. Check the email setup and try again." }, { status: 502 });
    }
    return Response.json({ challengeId, expiresInSeconds: 600 });
  } finally { await connection.end(); }
}
