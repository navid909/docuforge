import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Premium — DocuForge",
  description: "Go premium for unlimited ad-free PDF and document processing.",
};

export default function PremiumPage() {
  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Go Premium</h1>
        <p className="mt-2 text-slate-600">
          Unlock unlimited tasks, larger files, priority processing, and no ads.
        </p>
      </div>

      <div className="rounded-xl border bg-white p-6 shadow-md ring-1 ring-indigo-200">
        <h2 className="text-xl font-semibold">Premium plan</h2>
        <p className="mt-3 flex items-baseline gap-1">
          <span className="text-4xl font-bold">$6</span>
          <span className="text-sm text-slate-500">/ month</span>
        </p>
        <ul className="mt-5 space-y-3 text-sm text-slate-700">
          <li className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M5 13l4 4L19 7" />
            </svg>
            Unlimited tasks
          </li>
          <li className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M5 13l4 4L19 7" />
            </svg>
            100 MB file limit
          </li>
          <li className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M5 13l4 4L19 7" />
            </svg>
            Priority queue
          </li>
          <li className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M5 13l4 4L19 7" />
            </svg>
            No ads
          </li>
        </ul>

        <a
          href={`${BACKEND}/premium/checkout?plan=premium_monthly`}
          className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Upgrade to Premium
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </a>

        <p className="mt-4 text-xs text-slate-500">
          Redirects to Stripe Checkout. Replace with live Stripe integration before launch.
        </p>
      </div>

      {/* Ad slot */}
      <div className="mt-12">
        <AdSlot label="Premium page ad" />
      </div>
    </div>
  );
}

function AdSlot({ label }: { label: string }) {
  return (
    <div className="border-2 border-dashed rounded-lg border-slate-200 py-8 text-center text-sm text-slate-400">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="block mt-1 text-xs">AdSense slot — configure publisher ID</span>
    </div>
  );
}
