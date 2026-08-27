'use client';

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

interface JobResult {
  status: "queued" | "processing" | "completed" | "failed";
  result?: {
    filename?: string;
    url?: string;
    files?: string[];
    text?: string;
  };
  error?: string;
}

interface ToolFormProps {
  tool: {
    slug: string;
    title: string;
    endpoint: string;
    accept: string;
    isText?: boolean;
    isMulti?: boolean;
    needsPages?: boolean;
  };
}

export default function ToolForm({ tool }: ToolFormProps) {
  const { data: session } = useSession();
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<JobResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [pages, setPages] = useState("");

  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

  // Check if we can launch the job (session presence)
  const canSubmit = !!session?.user;

  const submitJob = useCallback(async () => {
    if (!canSubmit) {
      setError("Please sign in to use this tool.");
      return;
    }
    if (!selectedFile && selectedFiles.length === 0) {
      setError("Select a file to process.");
      return;
    }
    setStatus("Queuing job…");
    setError("");
    setResult(null);
    setJobId(null);
    setProgress(0);

    const fd = new FormData();
    if (selectedFile) fd.append("file", selectedFile);
    if (selectedFiles.length > 0) {
      selectedFiles.forEach((f) => fd.append("files", f));
    }
    if (pages) fd.append("pages", pages);

    const headers: Record<string, string> = {};
    const apiKey = (session?.user as any)?.apiKey;
    if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

    try {
      const res = await fetch(`${BACKEND}${tool.endpoint}`, {
        method: "POST",
        headers,
        body: fd,
      });
      if (!res.ok) {
        const text = await res.text();
        setError(text || "Job submission failed.");
        setStatus("");
        return;
      }
      const data = await res.json();
      // Backend may return { job_id } or { filename, url } (sync fallback)
      const jobId = data.job_id || data.id;
      if (jobId) {
        setJobId(jobId);
        setPolling(true);
        pollJob(jobId);
      } else {
        // Synchronous response from backend
        if (data.filename || data.url) {
          setResult({
            status: "completed",
            result: {
              filename: data.filename,
              url: data.url,
              files: data.files,
              text: data.text,
            },
          });
          setStatus("Done");
        } else {
          setError("Unexpected response from server.");
        }
      }
    } catch (err: any) {
      setError(err.message || "Network error.");
      setStatus("");
    }
  }, [canSubmit, selectedFile, selectedFiles, pages, tool, session]);

  // Polling loop
  useEffect(() => {
    if (!polling || !jobId) return;
    let cancelled = false;

    async function poll() {
      while (!cancelled) {
        try {
          const res = await fetch(`${BACKEND}/api/status/${jobId}`, {
            headers: { Authorization: `Bearer ${(session?.user as any)?.apiKey ?? ""}` },
          });
          const data = (await res.json()) as JobResult;
          if (cancelled) return;
          if (data.status === "completed") {
            setResult(data);
            setStatus("Done");
            setPolling(false);
            setProgress(100);
            return;
          }
          if (data.status === "failed") {
            setError(data.error || "Processing failed.");
            setStatus("");
            setPolling(false);
            return;
          }
          // progress emissive
          setProgress(Math.min(95, (data as any).progress ?? 0));
          // Backoff: queued 5s, processing 2s
          const delay = data.status === "queued" ? 5000 : 2000;
          await new Promise((r) => setTimeout(r, delay));
        } catch {
          setError("Status check failed — refresh to retry.");
          setPolling(false);
          return;
        }
      }
    }
    poll();
    return () => { cancelled = true; };
  }, [polling, jobId, session]);

  // Render result
  const renderResult = () => {
    if (!result) return null;
    if (result.status === "failed") {
      return (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          Job failed: {result.error}
        </div>
      );
    }
    if (result.result?.text) {
      return (
        <div className="mt-4 space-y-3">
          <pre className="rounded-lg border bg-slate-50 p-4 whitespace-pre-wrap text-sm">
            {result.result.text}
          </pre>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(result.result.text || "")}
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v1" />
            </svg>
            Copy text
          </button>
        </div>
      );
    }
    if (result.result?.files) {
      return (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-600">Downloaded files:</p>
          <div>
            {(result.result.files as string[]).map((f) => (
              <a
                key={f}
                href={`${BACKEND}/download/${f}`}
                className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-slate-50 hover:text-indigo-800"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
                </svg>
                {f}
              </a>
            ))}
          </div>
        </div>
      );
    }
    if (result.result?.filename && result.result?.url) {
      return (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-600">Your file is ready:</p>
          <a
            href={`${BACKEND}${result.result.url}`}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            Download {result.result.filename}
          </a>
          <a
            href={`${BACKEND}/api/status/${jobId}`}
            className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            View job status
          </a>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-xl border bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{tool.title}</h1>
      </div>

      {/* File picker */}
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Upload file
          </label>
          {tool.isMulti ? (
            <input
              type="file"
              accept={tool.accept}
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                setSelectedFiles(files);
                setSelectedFile(null);
              }}
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
            />
          ) : (
            <input
              type="file"
              accept={tool.accept}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                setSelectedFile(f);
                setSelectedFiles([]);
              }}
              className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
            />
          )}
          {tool.needsPages && (
            <input
              type="text"
              value={pages}
              onChange={(e) => setPages(e.target.value)}
              placeholder="Page numbers, e.g. 1,2,3"
              className="mt-3 w-full rounded-lg border bg-white px-3 py-2 text-sm"
            />
          )}
        </div>

        <button
          type="button"
          onClick={submitJob}
          disabled={!canSubmit || !!error || (!!status && status !== "Done")}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition disabled:opacity-40 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          {!canSubmit ? (
            "Sign in to use this tool"
          ) : status === "Done" ? (
            "Processed — download below"
          ) : (
            "Process file"
          )}
        </button>

        {error && (
          <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Progress / status */}
        {status && status !== "Done" && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span className="font-medium">{status}</span>
              {progress > 0 && progress < 100 && <span>{progress}%</span>}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {result && result.status === "completed" && (
          <div className="mt-3 rounded-lg border bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <span className="font-medium">Completed</span>
          </div>
        )}

        {renderResult()}
      </div>

      {/* Ad slot: top tool ad */}
      <div className="mt-8">
        <AdSlot label="Tool page ad" />
      </div>
    </div>
  );
}

// Reusable ad placeholder — swap with AdSense <ins> when live
function AdSlot({ label }: { label: string }) {
  return (
    <div className="border-2 border-dashed rounded-lg border-slate-200 py-6 text-center text-sm text-slate-400">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="block mt-1 text-xs">AdSense slot — configure pub-################</span>
    </div>
  );
}
