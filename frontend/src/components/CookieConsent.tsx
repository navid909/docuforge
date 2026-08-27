'use client';

import { useState, useEffect } from "react";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("docuforge_cookie_consent");
    if (stored === "accepted" || stored === "dismissed") {
      setDismissed(true);
    } else {
      setVisible(true);
    }
  }, []);

  function accept() {
    localStorage.setItem("docuforge_cookie_consent", "accepted");
    setVisible(false);
    setDismissed(true);
  }

  function dismiss() {
    localStorage.setItem("docuforge_cookie_consent", "dismissed");
    setVisible(false);
    setDismissed(true);
  }

  if (dismissed) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-5xl px-4 pb-4 transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"
      }`}
    >
      <div className="rounded-xl border bg-white shadow-lg ring-1 ring-black/5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="text-sm text-slate-700">
            <p className="font-medium">
              We use cookies to improve your experience and analyze traffic.
            </p>
            <p className="mt-1 text-slate-500">
              By continuing to use this site you agree to our use of cookies.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={dismiss}
              className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Decline
            </button>
            <button
              type="button"
              onClick={accept}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
            >
              Accept cookies
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
