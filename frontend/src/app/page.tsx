'use client';

import Link from "next/link";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-4xl">
      {/* Hero */}
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
          Free online PDF &amp; document tools
        </h1>
        <p className="mt-4 text-lg text-slate-600">
          Convert, edit, and optimize PDFs and images fast. Files are processed securely and deleted shortly after.
        </p>
        <div className="mt-8 flex flex-col gap-3 justify-center sm:flex-row sm:justify-center">
          <Link
            href="/tools"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Browse tools
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 rounded-lg border px-5 py-3 text-sm font-medium text-slate-700 transition hover:bg-white hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
          >
            Sign in
          </Link>
        </div>
      </div>

      {/* Value props */}
      <div className="mb-12 grid gap-4 sm:grid-cols-3">
        <Feature title="Fast" text="Most tools finish in seconds. No queue during off-peak hours." />
        <Feature title="Private" text="Files are deleted after processing. Nothing gets stored long-term." />
        <Feature title="Mobile-friendly" text="Works on phone and desktop — upload and download anywhere." />
      </div>

      {/* Ad slot */}
      <div className="mb-12">
        <AdSlot label="Homepage ad" />
      </div>

      {/* Quick links */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold">Popular tools</h2>
        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-600">
          <Link href="/tools/pdf-to-word" className="rounded-md px-3 py-1.5 border bg-white transition hover:bg-slate-50 hover:text-indigo-700">
            PDF → Word
          </Link>
          <Link href="/tools/merge-pdfs" className="rounded-md px-3 py-1.5 border bg-white transition hover:bg-slate-50 hover:text-indigo-700">
            Merge PDFs
          </Link>
          <Link href="/tools/ocr-image" className="rounded-md px-3 py-1.5 border bg-white transition hover:bg-slate-50 hover:text-indigo-700">
            OCR
          </Link>
          <Link href="/tools/pdf-to-images" className="rounded-md px-3 py-1.5 border bg-white transition hover:bg-slate-50 hover:text-indigo-700">
            PDF → Images
          </Link>
          <Link href="/tools/premium" className="rounded-md px-3 py-1.5 border bg-white transition hover:bg-slate-50 hover:text-indigo-700">
            Go Premium
          </Link>
        </div>
      </div>
    </div>
  );
}

function Feature({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border bg-white p-5 shadow-sm">
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
    </div>
  );
}

function AdSlot({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-2xl border-2 border-dashed rounded-lg border-slate-200 py-8 text-center text-sm text-slate-400">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="block mt-1 text-xs">AdSense slot — configure publisher ID</span>
    </div>
  );
}
