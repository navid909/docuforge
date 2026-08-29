import type { Metadata } from "next";
import NextAuthProvider from "../components/NextAuthProvider";
import CookieConsent from "../components/CookieConsent";

export const metadata: Metadata = {
  title: "DocuForge — Free PDF & Document Tools",
  description: "Convert, edit, and optimize PDFs and images fast. Free tier with ads; premium for unlimited ad-free processing.",
  icons: {
    icon: [{ url: "/favicon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <NextAuthProvider>
          <AppShell>{children}</AppShell>
        </NextAuthProvider>
        <CookieConsent />
      </body>
    </html>
  );
}

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
          <a href="/" className="text-xl font-bold tracking-tight text-indigo-600">
            <span className="mr-2 inline-block h-6 w-6 overflow-hidden rounded-full bg-indigo-100 p-0.5">
              <svg viewBox="0 0 24 24" className="h-full w-full text-indigo-600" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <line x1="10" y1="9" x2="8" y2="9" />
              </svg>
            </span>
            DocuForge
          </a>
          <nav className="hidden items-center gap-1 md:flex">
            <NavLink href="/tools">Tools</NavLink>
            <NavLink href="/pricing">Pricing</NavLink>
            <NavLink href="/premium">Premium</NavLink>
          </nav>
          <NavUser />
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        {children}
      </main>
      <footer className="mt-auto border-t bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} DocuForge. All tools run in-browser with server-side processing.
        </div>
      </footer>
    </div>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-indigo-600"
    >
      {children}
    </a>
  );
}

function NavUser() {
  return (
    <div className="flex items-center gap-3">
      <a
        href="/auth"
        className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-indigo-600"
      >
        Sign in
      </a>
    </div>
  );
}
