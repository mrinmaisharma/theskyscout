import { env } from "cloudflare:workers";

export function runtimeValue(name: string) {
  const workerValue = (env as unknown as Record<string, unknown>)[name];
  return process.env[name] || (typeof workerValue === "string" ? workerValue : "");
}

export function mysqlConfig() {
  return {
    host: runtimeValue("MYSQL_HOST"),
    port: Number(runtimeValue("MYSQL_PORT") || 3306),
    user: runtimeValue("MYSQL_USER") || "root",
    password: runtimeValue("MYSQL_PASSWORD"),
    database: runtimeValue("MYSQL_DATABASE") || "skyscout",
    disableEval: true,
  };
}

export async function mysqlConnection() {
  const config = mysqlConfig();
  if (!config.host) throw new Error("MySQL development storage is not configured.");
  const mysql = await import("mysql2/promise");
  return mysql.createConnection(config);
}

export const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
export const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function securityKey() {
  const secret = runtimeValue("VOUCHER_SECURITY_SECRET");
  if (secret.length < 24) throw new Error("Voucher security is not configured.");
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
}

export async function hashOtp(challengeId: string, otp: string) {
  const key = await crypto.subtle.importKey("raw", await securityKey(), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${challengeId}:${otp}`));
  return bytesToBase64(new Uint8Array(signature));
}

export function secureEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

export async function encryptPassport(passportNumber: string) {
  const key = await crypto.subtle.importKey("raw", await securityKey(), "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(passportNumber));
  return { ciphertext: bytesToBase64(new Uint8Array(encrypted)), iv: bytesToBase64(iv) };
}

export async function decryptPassport(ciphertext: string, iv: string) {
  const key = await crypto.subtle.importKey("raw", await securityKey(), "AES-GCM", false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(iv) }, key, base64ToBytes(ciphertext));
  return new TextDecoder().decode(decrypted);
}

export function generateOtp() {
  const number = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return number.toString().padStart(6, "0");
}

type SqlConnection = { execute(sql: string, values?: unknown[]): Promise<[unknown, unknown]> };

export class OtpError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function verifyOtpChallenge(connection: SqlConnection, input: { challengeId: string; otp: string; voucherCode: string; purpose: "redeem" | "view" }) {
  const [rows] = await connection.execute("SELECT id,voucher_code,email,purpose,otp_hash,expires_at,attempts,consumed_at FROM voucher_otp_challenges WHERE id = ? FOR UPDATE", [input.challengeId]);
  const challenge = (rows as { id: string; voucher_code: string; email: string; purpose: string; otp_hash: string; expires_at: string; attempts: number; consumed_at: string | null }[])[0];
  if (!challenge || challenge.voucher_code !== input.voucherCode || challenge.purpose !== input.purpose) throw new OtpError("The security code request is invalid.");
  if (challenge.consumed_at) throw new OtpError("This security code has already been used.");
  if (new Date(challenge.expires_at).getTime() < Date.now()) throw new OtpError("This security code has expired. Request a new one.");
  if (challenge.attempts >= 5) throw new OtpError("Too many incorrect attempts. Request a new code.", 429);
  await connection.execute("UPDATE voucher_otp_challenges SET attempts = attempts + 1 WHERE id = ?", [challenge.id]);
  const submittedHash = await hashOtp(challenge.id, input.otp);
  if (!secureEqual(challenge.otp_hash, submittedHash)) throw new OtpError("The security code is incorrect.");
  await connection.execute("UPDATE voucher_otp_challenges SET consumed_at = ? WHERE id = ?", [new Date().toISOString(), challenge.id]);
  return { email: challenge.email };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = runtimeValue("RESEND_API_KEY");
  const from = runtimeValue("CONFIRMATION_FROM_EMAIL");
  if (!apiKey || !from) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    return response.ok;
  } catch { return false; }
}

export async function sendOtpEmail(email: string, otp: string, purpose: "redeem" | "view") {
  const action = purpose === "redeem" ? "confirm your voucher request" : "view your voucher details";
  return sendEmail(email, `Your SkyScout security code: ${otp}`, `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#102a3e"><h1>Your verification code</h1><p>Use this code to ${action}:</p><p style="font-size:32px;letter-spacing:8px;font-weight:800">${otp}</p><p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p></div>`);
}

export async function sendConfirmationEmail(input: { email: string; fullName: string; reference: string; route: string; travelDate: string }) {
  return sendEmail(input.email, `SkyScout voucher confirmed · ${input.reference}`, `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#102a3e"><h1>We received your flight request</h1><p>Hi ${escapeHtml(input.fullName)},</p><p>Your ${escapeHtml(input.route)} voucher request for ${escapeHtml(input.travelDate)} is confirmed.</p><p>We will review your details and contact you before sending your ticket within 48 hours.</p><p><strong>Reference: ${escapeHtml(input.reference)}</strong></p><p>No payment was taken.</p></div>`);
}
