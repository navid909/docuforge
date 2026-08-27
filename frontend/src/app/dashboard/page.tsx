export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-slate-600">
          Manage your account, usage, and job history.
        </p>
      </div>

      <Card title="Account">
        <p className="text-sm text-slate-600">
          Sign in at{" "}
          <a href="/auth" className="font-medium text-indigo-600 underline transition hover:text-indigo-700">
            /auth
          </a>{" "}
          to see account details, plan, and API key.
        </p>
        <div className="mt-4 flex gap-3">
          <a
            href="/auth"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Go to account
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </Card>

      <Card title="Usage">
        <p className="text-sm text-slate-600">
          Usage dashboard coming with premium account integration.
          Free tier: 3 tasks per day, 10MB file limit.
        </p>
      </Card>

      <Card title="Recent jobs">
        <p className="text-sm text-slate-600">
          Job history is available after sign-in. Each tool page shows the latest result.
        </p>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}
