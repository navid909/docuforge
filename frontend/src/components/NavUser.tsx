"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

export default function NavUser() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="h-10 w-32 animate-pulse rounded-md bg-slate-100" />
    );
  }

  if (session?.user) {
    const name = session.user.name || session.user.email?.split("@")[0] || "User";
    const initials = name.slice(0, 2).toUpperCase();
    return (
      <div className="flex items-center gap-2">
        <div className="hidden sm:block text-sm text-slate-600">
          <span className="text-slate-400">Signed in as </span>
          <span className="truncate max-w-[140px] sm:max-w-[200px]">
            {session.user.email}
          </span>
        </div>
        <Link
          href="/auth"
          className="inline-flex items-center gap-2 rounded-full bg-indigo-100 p-1 text-indigo-700 transition hover:bg-indigo-200"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-bold ring-1 ring-indigo-200">
            {initials}
          </span>
          <span className="hidden text-sm">{name}</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100">
        Sign in
      </span>
    </div>
  );
}
