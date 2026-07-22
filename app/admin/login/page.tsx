"use client";

import { FormEvent, useState } from "react";

export default function AdminLoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: form.get("username"), password: form.get("password") }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Sign-in failed.");
      window.location.assign("/admin/vouchers");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Sign-in failed."); }
    finally { setLoading(false); }
  };
  return <main className="admin-login-page"><section className="admin-login-card"><a className="brand" href="/"><span className="brand-mark"><i /><i /><i /></span><span>skyscout</span></a><p className="voucher-kicker">Restricted area</p><h1>Voucher admin</h1><p>Sign in to create vouchers, manage eligible travel dates, and review voucher status.</p><form onSubmit={submit}><label className="voucher-field"><span>Username</span><input name="username" autoComplete="username" required /></label><label className="voucher-field"><span>Password</span><input name="password" type="password" autoComplete="current-password" required /></label>{error && <div className="voucher-error">{error}</div>}<button className="voucher-submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}<span>→</span></button></form></section></main>;
}
