import { runtimeValue, secureEqual } from "@/lib/voucher-security";

export const ADMIN_COOKIE = "skyscout_admin";

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signature(payload: string) {
  const secret = runtimeValue("VOUCHER_SECURITY_SECRET");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
}

export async function createAdminSession() {
  const username = runtimeValue("ADMIN_USERNAME") || "admin";
  const expires = Date.now() + 8 * 60 * 60_000;
  const payload = `${username}.${expires}`;
  return { token: `${payload}.${await signature(payload)}`, expires: new Date(expires) };
}

export async function verifyAdminSession(token: string | undefined) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [username, expiresText, suppliedSignature] = parts;
  if (username !== (runtimeValue("ADMIN_USERNAME") || "admin") || Number(expiresText) <= Date.now()) return false;
  return secureEqual(await signature(`${username}.${expiresText}`), suppliedSignature);
}

export function verifyAdminCredentials(username: string, password: string) {
  const expectedUsername = runtimeValue("ADMIN_USERNAME") || "admin";
  const expectedPassword = runtimeValue("ADMIN_PASSWORD");
  return Boolean(expectedPassword) && secureEqual(username, expectedUsername) && secureEqual(password, expectedPassword);
}

export async function adminAuthorized(request: Request) {
  const cookie = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${ADMIN_COOKIE}=`))?.slice(ADMIN_COOKIE.length + 1);
  return verifyAdminSession(cookie ? decodeURIComponent(cookie) : undefined);
}
