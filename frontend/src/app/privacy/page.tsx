export const metadata = {
  title: 'Privacy Policy — DocuForge',
  description: 'Privacy policy for DocuForge PDF and document tools.',
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold">Privacy Policy</h1>
      <p className="mt-2 text-slate-600">Last updated: September 2026</p>

      <div className="mt-8 space-y-6">
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">1. Data we collect</h2>
          <p className="text-slate-700">
            We collect minimal information needed to operate the service, including account email, usage metadata, and temporary file data during processing.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">2. File handling</h2>
          <p className="text-slate-700">
            Uploaded files are stored temporarily for processing and are deleted automatically after a short retention period. We do not use your files for training or other purposes.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">3. Cookies and analytics</h2>
          <p className="text-slate-700">
            We may use cookies and analytics tools to improve performance and user experience. Advertising partners may use cookies in accordance with their own policies.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">4. Contact</h2>
          <p className="text-slate-700">
            For privacy questions, visit the <a href="/contact" className="text-indigo-600 underline">Contact</a> page.
          </p>
        </section>
      </div>
    </div>
  );
}
