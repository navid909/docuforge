'use client';
import { useState, useEffect } from 'react';

export default function ResultClient({
  endpoint,
  method,
  tool,
  isText,
  isMulti,
  needsPages,
}: {
  endpoint: string;
  method: string;
  tool: string;
  isText: boolean;
  isMulti: boolean;
  needsPages: boolean;
}) {
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const [apiKey, setApiKey] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const key = localStorage.getItem('docuforge_api_key') || '';
      setApiKey(key);
    }
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus('Processing...');
    setError('');
    setResult(null);
    const fd = new FormData(e.currentTarget);
    const headers: Record<string, string> = {};
    const currentKey = typeof window !== 'undefined' ? localStorage.getItem('docuforge_api_key') : apiKey;
    if (currentKey) {
      headers['Authorization'] = `Bearer ${currentKey}`;
    }
    const res = await fetch(endpoint, {
      method,
      headers,
      body: fd as any,
    });
    if (!res.ok) {
      const msg = await res.text();
      setError(msg || 'Failed');
      setStatus('');
      return;
    }
    const data = await res.json();
    setResult(data);
    setStatus('Done');
  }

  return (
    <div className="mt-8 border rounded-xl p-6 bg-white">
      <h2 className="text-lg font-semibold mb-3">Process file</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Upload file</label>
          <input
            type="file"
            name="file"
            accept={
              isMulti
                ? '.pdf'
                : tool === 'image-to-pdf'
                  ? 'image/*'
                  : tool === 'ocr-image'
                    ? 'image/*'
                    : '.pdf'
            }
            multiple={isMulti}
            required
            className="w-full border rounded-lg p-2"
          />
          {needsPages && (
            <input
              name="pages"
              placeholder="Page numbers, e.g. 1,2,3"
              className="mt-3 w-full border rounded-lg p-2"
            />
          )}
        </div>
        <button
          type="submit"
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
        >
          Process
        </button>
      </form>
      {status && !error && <p className="mt-3 text-sm text-slate-700">{status}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {isText && result?.text && (
        <div className="mt-4">
          <pre className="bg-slate-50 border rounded-lg p-4 whitespace-pre-wrap text-sm">{result.text}</pre>
          <button
            onClick={() => navigator.clipboard.writeText(result.text)}
            className="mt-3 text-sm border rounded-lg px-3 py-2 hover:bg-slate-50"
          >
            Copy text
          </button>
        </div>
      )}
      {!isText && result?.filename && (
        <div className="mt-4">
          <a
            href={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}${result.url}`}
            className="inline-flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700"
          >
            Download {result.filename}
          </a>
        </div>
      )}
      {!isText && result?.files && (
        <div className="mt-4 space-y-2">
          {(result.files as string[]).map((f) => (
            <div key={f}>
              <a
                href={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}/download/${f}`}
                className="text-indigo-700 underline"
              >
                {f}
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
