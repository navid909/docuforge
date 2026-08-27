import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — DocuForge",
  description: "DocuForge plans: free tier with ads, premium for unlimited ad-free processing.",
};

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">Pricing</h1>
        <p className="mt-2 text-slate-600">
          Start free with ads. Upgrade to premium for unlimited, ad-free processing.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* Free */}
        <div className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Free</h2>
          <p className="mt-3 flex items-baseline gap-1">
            <span className="text-4xl font-bold">$0</span>
            <span className="text-sm text-slate-500">/ month</span>
          </p>
          <ul className="mt-5 space-y-3 text-sm text-slate-700">
            <li className="flex items-start gap-3">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M5 13l4 4L19 7" />
              </svg>
              3 tasks per day
            </li>
            <li className="flex items-start gap-3">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M5 13l4 4L19 7" />
              </svg>
              10 MB file limit
            </li>
            <li className="flex items-start gap-3">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M5 13l4 4L19 7" />
              </svg>
              Standard queue
            </li>
            <li className="flex items-start gap-3">
              <svg className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M6 18L18 6M6 6l12 12" />
              </svg>
              Ads enabled
            </li>
          </ul>
          <button className="mt-6 w-full rounded-lg border bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-indigo-700">
            Current plan
          </button>
        </div>

        {/* Premium */}
        <div className="rounded-xl border bg-white p-6 shadow-md ring-1 ring-indigo-200">
          <h2 className="text-xl font-semibold">Premium</h2>
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
          <button className="mt-6 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
            Upgrade to Premium
          </button>
        </div>
      </div>

      {/* Ad slot */}
      <div className="mt-12">
        <AdSlot label="Pricing page ad" />
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
