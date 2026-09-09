'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { useCallback, useEffect, useRef, useState } from 'react';

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
  const { account, loading } = useAuth();
  const [heroAnimation, setHeroAnimation] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setHeroAnimation(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handleSignIn = useCallback(async () => {
    const email = prompt('Enter your email to sign in:');
    if (!email) return;
    try {
      const res = await fetch(`${BACKEND}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Signed in as ${email}`);
      } else {
        const signup = await fetch(`${BACKEND}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
        });
        if (signup.ok) {
          alert(`Account created: ${email}`);
        } else {
          alert('Sign in failed');
        }
      }
    } catch {
      alert('Network error');
    }
  }, []);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
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
            <Link href="/tools" className="hidden rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-indigo-600 sm:inline-block">
              Tools
            </Link>
            <Link href="/pricing" className="hidden rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-indigo-600 sm:inline-block">
              Pricing
            </Link>
            {account ? (
              <span className="rounded-md bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 sm:hidden">
                Signed in
              </span>
            ) : (
              <button
                onClick={handleSignIn}
                className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-indigo-600 sm:hidden"
              >
                Sign in
              </button>
            )}
            <Link href="/auth" className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-indigo-600 sm:inline-block">
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b bg-gradient-to-b from-indigo-50/50 to-white">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="text-center">
            <div className="mx-auto mb-4 inline-flex h-12 w-12 animate-pulse rounded-xl bg-indigo-100 p-0.5">
              <svg viewBox="0 0 24 24" className="h-8 w-8 text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <line x1="10" y1="9" x2="8" y2="9" />
              </svg>
            </div>
            <h1 className={`text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl transition-all duration-500 ${heroAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              Free online PDF &amp; document tools
            </h1>
            <p className={`mt-3 max-w-2xl mx-auto text-base sm:text-lg text-slate-600 transition-all duration-500 delay-100 ${heroAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              Convert, edit, and optimize PDFs and images fast. All tools are free and files are deleted after processing.
            </p>
            <div className={`mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row sm:justify-center transition-all duration-500 delay-200 ${heroAnimation ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <Link
                href="/tools"
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                Browse all tools
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </Link>
              {!account && (
                <button
                  onClick={handleSignIn}
                  className="inline-flex items-center gap-2 rounded-lg border px-6 py-3 text-sm font-medium text-slate-700 transition hover:bg-white hover:text-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                >
                  Sign in
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Tools grid */}
      <section className="border-b bg-white py-10 sm:py-12 lg:py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <h2 className="mb-2 text-center text-lg font-semibold sm:text-xl">All tools</h2>
          <p className="mb-8 text-center text-sm text-slate-500 sm:text-base">Choose a tool to get started — all free, no signup required for basic use.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map((tool) => (
              <Link
                key={tool.slug}
                href={`/tools/${tool.slug}`}
                className="group flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 transition hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-50/50"
              >
                <span className="text-3xl">{tool.icon}</span>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 transition group-hover:text-indigo-600">
                    {tool.title}
                  </h3>
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

      {/* Features */}
      <section className="border-b bg-slate-50/80 py-10 sm:py-12">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 sm:grid-cols-3">
            <FeatureCard icon="⚡" title="Fast" text="Most tools finish in seconds. No queue during off-peak hours." />
            <FeatureCard icon="🔒" title="Private" text="Files are deleted after processing. Nothing gets stored long-term." />
            <FeatureCard icon="📱" title="Works everywhere" text="Use on phone or desktop — upload and download from anywhere." />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-white py-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 pb-4 text-center text-xs text-slate-400 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex flex-wrap justify-center gap-4">
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

function FeatureCard({ icon, title, text }: { icon: string; title: string; text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-white p-5">
      <span className="text-xl">{icon}</span>
      <div>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="mt-1 text-sm text-slate-500">{text}</p>
      </div>
    </div>
  );
}
