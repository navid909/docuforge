'use client';

import { useState } from 'react';

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const form = e.currentTarget;
    const data = {
      name: (form.elements.namedItem('name') as HTMLInputElement).value.trim(),
      email: (form.elements.namedItem('email') as HTMLInputElement).value.trim(),
      message: (form.elements.namedItem('message') as HTMLTextAreaElement).value.trim(),
    };

    if (!data.name || !data.email || !data.message) {
      setError('Please fill in all fields.');
      return;
    }

    // Placeholder submit handler
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-bold">Contact</h1>
        <p className="mt-4 text-slate-700">Thanks for reaching out. This is a demo form; in production this would send your message to the DocuForge team.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold">Contact</h1>
      <p className="mt-2 text-slate-600">Have a question or issue? Send a message below.</p>

      <form onSubmit={submit} className="mt-8 space-y-4 rounded-xl border bg-white p-6 shadow-sm">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-slate-700">Name</label>
          <input id="name" name="name" type="text" required className="w-full rounded-lg border bg-white px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">Email</label>
          <input id="email" name="email" type="email" required className="w-full rounded-lg border bg-white px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="message" className="mb-1 block text-sm font-medium text-slate-700">Message</label>
          <textarea id="message" name="message" rows={4} required className="w-full rounded-lg border bg-white px-3 py-2 text-sm" />
        </div>
        {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <button type="submit" className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700">Send message</button>
      </form>
    </div>
  );
}
