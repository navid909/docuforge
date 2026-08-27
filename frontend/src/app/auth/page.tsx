'use client';

import { useState } from "react";
import Link from "next/link";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function AuthPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [account, setAccount] = useState<{ email: string; apiKey: string; premium: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const emailTrim = email.trim().toLowerCase();
    if (!emailTrim) {
      setError("Enter an email to continue.");
      setLoading(false);
      return;
    }
    try {
      const loginRes = await fetch(`${BACKEND}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailTrim }),
      });
      if (loginRes.ok) {
        const data = await loginRes.json();
        setAccount({ email: emailTrim, apiKey: data.api_key, premium: !!data.premium });
        localStorage.setItem("docuforge_account", JSON.stringify({ email: emailTrim, apiKey: data.api_key, premium: !!data.premium }));
        setLoading(false);
        return;
      }
      const signupRes = await fetch(`${BACKEND}/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailTrim }),
      });
      const data = await signupRes.json();
      if (!signupRes.ok) throw new Error(data.detail || "Signup failed");
      setAccount({ email: emailTrim, apiKey: data.api_key, premium: false });
      localStorage.setItem("docuforge_account", JSON.stringify({ email: emailTrim, apiKey: data.api_key, premium: false }));
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  if (account) {
    return (
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-bold">Your account</h1>
        <div className="mt-6 space-y-4 rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-semibold text-sm">
              {account.email[0]?.toUpperCase()}
            </div>
            <div>
              <p className="font-semibold text-sm">{account.email}</p>
              <p className="text-xs text-slate-500 capitalize">{account.premium ? "Premium member" : "Free plan"}</p>
            </div>
          </div>
          <div className="rounded-lg border bg-slate-50 px-3 py-2 text-xs font-mono text-slate-700 break-all">
            {account.apiKey}
          </div>
          <div className="flex gap-3">
            <Link href="/tools" className="flex-1 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-indigo-600">Browse tools</Link>
            <Link href="/pricing" className="flex-1 rounded-lg border bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-indigo-600">Pricing</Link>
            <button type="button" onClick={() => { setAccount(null); localStorage.removeItem("docuforge_account"); }} className="rounded-lg border px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 hover:text-red-700">Sign out</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-3xl font-bold tracking-tight">Sign in to DocuForge</h1>
      <p className="mt-2 text-slate-600">Enter your email below. We’ll sign you in or create a free account instantly.</p>
      <div className="mt-8 space-y-4">
        <form onSubmit={submit} className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">Email address</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required className="w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-slate-200 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition disabled:opacity-50 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>
        <div className="rounded-xl border bg-white px-4 py-3 shadow-sm">
          <p className="text-xs text-slate-500">No password required — sign in with your email only. Your API key is stored locally for tool access.</p>
        </div>
      </div>
    </div>
  );
}
