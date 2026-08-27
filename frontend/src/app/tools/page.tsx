import type { Metadata } from "next";
import ToolForm from "./[tool]/ToolForm";

const TOOLS = [
  { slug: "pdf-to-word", title: "PDF to Word", desc: "Convert PDF into an editable Word document.", icon: "📄", accept: ".pdf", isText: false, isMulti: false, needsPages: false },
  { slug: "pdf-to-excel", title: "PDF to Excel", desc: "Extract tables and text from PDF into Excel.", icon: "📊", accept: ".pdf", isText: false, isMulti: false, needsPages: false },
  { slug: "pdf-to-ppt", title: "PDF to PPT", desc: "Turn PDF pages into PowerPoint slides.", icon: "📑", accept: ".pdf", isText: false, isMulti: false, needsPages: false },
  { slug: "pdf-to-images", title: "PDF to Images", desc: "Export PDF pages as JPG images.", icon: "🖼️", accept: ".pdf", isText: false, isMulti: false, needsPages: false },
  { slug: "image-to-pdf", title: "Image to PDF", desc: "Convert JPG/PNG into a PDF file.", icon: "🖼️📄", accept: "image/*", isText: false, isMulti: false, needsPages: false },
  { slug: "docx-to-pdf", title: "Word to PDF", desc: "Convert DOCX into PDF.", icon: "📝", accept: ".docx", isText: false, isMulti: false, needsPages: false },
  { slug: "xlsx-to-pdf", title: "Excel to PDF", desc: "Convert XLSX into PDF.", icon: "📈", accept: ".xlsx", isText: false, isMulti: false, needsPages: false },
  { slug: "pptx-to-pdf", title: "PPT to PDF", desc: "Convert PPTX into PDF.", icon: "📽️", accept: ".pptx", isText: false, isMulti: false, needsPages: false },
  { slug: "merge-pdfs", title: "Merge PDFs", desc: "Combine multiple PDFs into one.", icon: "🔗", accept: ".pdf", isText: false, isMulti: true, needsPages: false },
  { slug: "split-pdf", title: "Split PDF", desc: "Extract specific pages from a PDF.", icon: "✂️", accept: ".pdf", isText: false, isMulti: false, needsPages: true },
  { slug: "compress-pdf", title: "Compress PDF", desc: "Reduce PDF file size safely.", icon: "📦", accept: ".pdf", isText: false, isMulti: false, needsPages: false },
  { slug: "ocr-image", title: "OCR Image", desc: "Extract text from an image or scan.", icon: "🔍", accept: "image/*", isText: true, isMulti: false, needsPages: false },
] as const;

export const metadata: Metadata = {
  title: "PDF & Document Tools — DocuForge",
  description: "Free online PDF and document conversion tools. Convert, merge, split, compress, and OCR.",
};

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight">All tools</h1>
        <p className="mt-2 text-slate-600">
          Pick a tool, upload your file, and process it instantly. Sign in for unlimited access.
        </p>
      </div>

      {/* Tool grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {TOOLS.map((tool) => (
          <a
            key={tool.slug}
            href={`/tools/${tool.slug}`}
            className="group flex flex-col rounded-xl border bg-white p-5 shadow-sm transition hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-50"
          >
            <span className="text-3xl" aria-hidden="true">{tool.icon}</span>
            <h3 className="mt-3 font-semibold text-lg text-slate-900 group-hover:text-indigo-700">
              {tool.title}
            </h3>
            <p className="mt-1 text-sm text-slate-600">{tool.desc}</p>
            <span className="mt-auto pt-4 text-xs font-medium text-indigo-600 opacity-0 transition group-hover:opacity-100">
              Use tool →
            </span>
          </a>
        ))}
      </div>

      {/* Ad slot */}
      <div className="mt-12">
        <AdSlot label="Tools catalog ad" />
      </div>
    </div>
  );
}

function AdSlot({ label }: { label: string }) {
  return (
    <div className="border-2 border-dashed rounded-lg border-slate-200 py-8 text-center text-sm text-slate-400">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="block mt-1 text-xs">AdSense slot — configure publisher ID</span>
    </div>
  );
}
