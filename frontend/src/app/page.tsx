'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

const TOOLS = [
  { slug: 'image-to-pdf', title: 'Image to PDF', icon: '🖼️', desc: 'Turn images into PDF' },
  { slug: 'pdf-to-word', title: 'PDF to Word', icon: '📄', desc: 'Convert PDF to editable Word' },
  { slug: 'merge-pdfs', title: 'Merge PDF', icon: '🔗', desc: 'Combine multiple PDFs' },
  { slug: 'compress-pdf', title: 'Compress PDF', icon: '📦', desc: 'Reduce file size' },
  { slug: 'ocr-image', title: 'OCR', icon: '🔍', desc: 'Extract text from images' },
  { slug: 'docx-to-pdf', title: 'Word to PDF', icon: '📝', desc: 'Convert Word to PDF' },
];

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export default function HomePage() {
  const [heroAnimating, setHeroAnimating] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroAnimating(true), 150);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky header with glassmorphism */}
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold text-indigo-600">
            <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
            DocuForge
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link href="/tools" className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-indigo-600 sm:inline-block">
              Tools
            </Link>
            <Link href="/pricing" className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-indigo-600 sm:inline-block">
              Pricing
            </Link>
            <Link href="/auth" className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-indigo-600 sm:inline-block">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero with animated entrance and gradient background band */}
      <section className="border-b">
        <div className="relative mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-32 overflow-hidden">
          {/* Gradient background band */}
          <div className="absolute top-0 left-0 right-0 h-96 bg-gradient-to-b from-indigo-500/20 via-purple-500/10 to-pink-500/20 pointer-events-none opacity-80" />
          <div className="relative z-10">
            <div className="mx-auto text-center">
              {/* Pulse animation indicator */}
              <div className="mx-auto mb-6 inline-flex h-12 w-12 animate-pulse rounded-xl bg-indigo-100 p-0.5">
                <svg viewBox="0 0 24 24" className="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                  <line x1="10" y1="9" x2="8" y2="9" />
                </svg>
              </div>

              <h1 className={`text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl transition-all duration-500 ${heroAnimating ? 'opacity-100 translateY-0' : 'opacity-0 translateY-4'}`}>
                Free online PDF & document tools
              </h1>

              <p className={`mt-4 max-w-2xl mx-auto text-lg sm:text-xl text-slate-600 transition-all duration-500 delay-100 ${heroAnimating ? 'opacity-100 translateY-0' : 'opacity-0 translateY-4'}`}>
                Convert, edit, and optimize PDFs and images fast. Files are processed securely and deleted shortly after.
              </p>

              <div className={`mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 transition-all duration-500 delay-200 ${heroAnimating ? 'opacity-100 translateY-0' : 'opacity-0 translateY-4'}`}>
                <Link
                  href="/tools"
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-8 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
                >
                  Browse all tools
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </Link>
                {!true && (/* account check placeholder */ null)}
                <button
                  onClick={() => alert('Sign in handler placeholder')}
                  className="inline-flex items-center gap-2 rounded-lg border px-8 py-3 text-sm font-medium text-slate-700 transition hover:bg-white hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                >
                  Sign in
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tools grid */}
      <section className="border-b bg-white py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-2 text-center text-lg font-semibold sm:text-xl">All tools</h2>
          <p className="mb-8 text-center text-sm text-slate-500 sm:text-base">Choose a tool to get started — all free, no signup required for basic use.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((tool) => (
              <Link
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 transition hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-50/50"
                onMouseEnter={() => {}}
                onMouseLeave={() => {}}
              >
                <span className="text-3xl">{tool.icon}</span>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 transition group-hover:text-indigo-600">{tool.title}</h3>
                  <p className="mt-1 text-sm text-slate-500">{tool.desc}</p>
                </div>
                <span className="mt-auto flex items-center gap-1 text-xs font-medium text-indigo-600 opacity-0 transition group-hover:opacity-100">
                  Open tool
                  <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Features section */}
      <section className="border-b bg-slate-50/80 py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-3">
            <div className="flex items-start gap-3 rounded-xl bg-white p-5">
              <span className="text-xl flex-shrink-0">⚡</span>
              <div>
                <h3 className="font-semibold text-slate-900">Fast</h3>
                <p className="mt-1 text-sm text-slate-500">Most tools finish in seconds. No queue during off-peak hours.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl bg-white p-5">
              <span className="text-xl flex-shrink-0">🔒</span>
              <div>
                <h3 className="font-semibold text-slate-900">Private</h3>
                <p className="mt-1 text-sm text-slate-500">Files are deleted after processing. Nothing gets stored long-term.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-xl bg-white p-5">
              <span className="text-xl flex-shrink-0">📱</span>
              <div>
                <h3 className="font-semibold text-slate-900">Works everywhere</h3>
                <p className="mt-1 text-sm text-slate-500">Use on phone or desktop — upload and download from anywhere.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-6">
        <div className="mx-auto max-w-6xl px-4 pb-4 text-center text-xs text-slate-400 sm:px-6 lg:px-8">
          <div className="mb-4 flex flex-wrap justify-center gap-4">
            <Link href="/terms" className="hover:text-indigo-600">Terms</Link>
            <Link href="/privacy" className="hover:text-indigo-600">Privacy</Link>
            <Link href="/contact" className="hover:text-indigo-600">Contact</Link>
          </div>
          <p>© {new Date().getFullYear()} DocuForge. All tools run in-browser with server-side processing.</p>
        </div>
      </footer>
    </div>
  );
}