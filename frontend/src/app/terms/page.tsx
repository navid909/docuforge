export const metadata = {
  title: 'Terms of Service — DocuForge',
  description: 'Terms of service for DocuForge PDF and document tools.',
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold">Terms of Service</h1>
      <p className="mt-2 text-slate-600">Last updated: September 2026</p>

      <div className="mt-8 space-y-6">
        <section className="space-y-2">
          <h2 className="text-xl font-semibold">1. Acceptance of terms</h2>
          <p className="text-slate-700">
            By using DocuForge, you agree to these terms. If you do not agree, please do not use the service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">2. Use of service</h2>
          <p className="text-slate-700">
            DocuForge provides online document conversion tools. You are responsible for the content you upload and for complying with applicable laws.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">3. Intellectual property</h2>
          <p className="text-slate-700">
            You retain ownership of files you upload. DocuForge does not claim ownership of your content.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">4. Disclaimers</h2>
          <p className="text-slate-700">
            The service is provided as-is. We do not guarantee uninterrupted availability or error-free processing.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-xl font-semibold">5. Contact</h2>
          <p className="text-slate-700">
            For questions about these terms, visit the <a href="/contact" className="text-indigo-600 underline">Contact</a> page.
          </p>
        </section>
      </div>
    </div>
  );
}
