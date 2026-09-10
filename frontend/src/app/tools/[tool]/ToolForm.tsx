'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';

interface JobResult {
  status: 'queued' | 'processing' | 'completed' | 'failed';
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
  const { account, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<JobResult | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [pages, setPages] = useState('');
  const [uploading, setUploading] = useState(false);

  const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
  const canSubmit = !!account && !authLoading;

  const submitJob = useCallback(async () => {
    if (!canSubmit) {
      setError('Please sign in to use this tool.');
      return;
    }
    if (!selectedFile && selectedFiles.length === 0) {
      setError('Select a file to process.');
      return;
    }
    setUploading(true);
    setStatus('Processing…');
    setError('');
    setResult(null);
    setJobId(null);
    setProgress(0);

    const fd = new FormData();
    fd.append('tool', tool.slug);
    if (selectedFile) fd.append('file', selectedFile);
    if (selectedFiles.length > 0) {
      selectedFiles.forEach((f) => fd.append('files', f));
    }
    if (pages) fd.append('pages', pages);

    const headers: Record<string, string> = {};
    if (account?.token) headers['Authorization'] = `Bearer ${account.token}`;

    try {
      const res = await fetch(`${BACKEND}/api/convert`, {
        method: 'POST',
        headers,
        body: fd,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const message = data?.error || `Job submission failed with status ${res.status}.`;
        setError(message);
        setStatus('');
        setUploading(false);
        return;
      }

      const newJobId = data.jobId || data.id;
      if (newJobId) {
        setJobId(newJobId);
        setPolling(true);
      } else if (data.download?.filename || data.url) {
        setResult({
          status: 'completed',
          result: {
            filename: data.download?.filename,
            url: data.download?.url,
            files: data.files,
            text: data.text,
          },
        });
        setStatus('Done');
        setUploading(false);
      } else {
        setError('Unexpected response from server.');
        setStatus('');
        setUploading(false);
      }
    } catch (err: any) {
      setError(err.message || 'Network error.');
      setStatus('');
      setUploading(false);
    }
  }, [canSubmit, selectedFile, selectedFiles, pages, tool, account, BACKEND]);

  useEffect(() => {
    if (!polling || !jobId) return;
    let cancelled = false;

    async function poll() {
      while (!cancelled) {
        try {
          const headers: Record<string, string> = {};
          if (account?.token) headers['Authorization'] = `Bearer ${account.token}`;
          const res = await fetch(`${BACKEND}/api/status/${jobId}`, { headers });
          const data = (await res.json()) as JobResult;
          if (cancelled) return;
          if (data.status === 'completed') {
            setResult(data);
            setStatus('Done');
            setPolling(false);
            setProgress(100);
            setUploading(false);
            return;
          }
          if (data.status === 'failed') {
            setError(data.error || 'Processing failed.');
            setStatus('');
            setPolling(false);
            setUploading(false);
            return;
          }
          setProgress(Math.min(95, (data as any).progress ?? 0));
          const delay = data.status === 'queued' ? 5000 : 2000;
          await new Promise((r) => setTimeout(r, delay));
        } catch {
          setError('Status check failed — refresh to retry.');
          setPolling(false);
          setUploading(false);
          return;
        }
      }
    }
    poll();
    return () => { cancelled = true; };
  }, [polling, jobId, account, BACKEND]);

  const renderResult = () => {
    if (!result) return null;
    if (result.status === 'failed') {
      return <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">Job failed: {result.error}</div>;
    }
    if (result.result?.text) {
      return (
        <div className="mt-4 space-y-3">
          <pre className="rounded-lg border bg-slate-50 p-4 whitespace-pre-wrap text-sm">{result.result.text}</pre>
          <button type="button" onClick={() => navigator.clipboard.writeText(result.result?.text || '')} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            Copy text
          </button>
        </div>
      );
    }
    if (result.result?.files) {
      return (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-slate-600">Downloaded files:</p>
          <div className="flex flex-wrap gap-2">
            {(result.result.files as string[]).map((f) => (
              <a key={f} href={`${BACKEND}/download/${f}`} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-slate-50 hover:text-indigo-800">
                Download {f}
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
          <a href={`${BACKEND}${result.result.url}`} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700">
            Download {result.result.filename}
          </a>
          <a href={`${BACKEND}/api/status/${jobId}`} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50">
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
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Upload file</label>
          {tool.isMulti ? (
            <input type="file" accept={tool.accept} multiple onChange={(e) => { const files = Array.from(e.target.files || []); setSelectedFiles(files); setSelectedFile(null); }} className="w-full rounded-lg border bg-white px-3 py-2 text-sm" />
          ) : (
            <input type="file" accept={tool.accept} onChange={(e) => { const f = e.target.files?.[0] ?? null; setSelectedFile(f); setSelectedFiles([]); }} className="w-full rounded-lg border bg-white px-3 py-2 text-sm" />
          )}
          {tool.needsPages && (
            <input type="text" value={pages} onChange={(e) => setPages(e.target.value)} placeholder="Page numbers, e.g. 1,2,3" className="mt-3 w-full rounded-lg border bg-white px-3 py-2 text-sm" />
          )}
        </div>
        <button type="button" onClick={submitJob} disabled={!canSubmit || uploading || !!error || (!!status && status !== 'Done')} className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition disabled:opacity-40 hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
          {uploading ? (
            <span className="inline-flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              Processing…
            </span>
          ) : !canSubmit ? (
            'Sign in to use this tool'
          ) : status === 'Done' ? (
            'Processed — download below'
          ) : (
            'Process file'
          )}
        </button>
        {error && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        {status && status !== 'Done' && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <span className="font-medium">{status}</span>
              {progress > 0 && progress < 100 && <span>{progress}%</span>}
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}
        {result && result.status === 'completed' && <div className="mt-3 rounded-lg border bg-emerald-50 px-3 py-2 text-sm text-emerald-800"><span className="font-medium">Completed</span></div>}
        {renderResult()}
      </div>
      <div className="mt-8">
        <div className="border-2 border-dashed rounded-lg border-slate-200 py-6 text-center text-sm text-slate-400">AdSense slot — configure pub-################</div>
      </div>
    </div>
  );
}
