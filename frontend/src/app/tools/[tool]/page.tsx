import { notFound } from "next/navigation";
import ToolForm from "./ToolForm";

const TOOLS = {
  "pdf-to-word": { title: "PDF to Word", endpoint: "/api/convert", accept: ".pdf", isText: false, isMulti: false, needsPages: false },
  "pdf-to-excel": { title: "PDF to Excel", endpoint: "/api/convert", accept: ".pdf", isText: false, isMulti: false, needsPages: false },
  "pdf-to-ppt": { title: "PDF to PPT", endpoint: "/api/convert", accept: ".pdf", isText: false, isMulti: false, needsPages: false },
  "pdf-to-images": { title: "PDF to Images", endpoint: "/api/convert", accept: ".pdf", isText: false, isMulti: false, needsPages: false },
  "image-to-pdf": { title: "Image to PDF", endpoint: "/api/convert", accept: "image/*", isText: false, isMulti: false, needsPages: false },
  "docx-to-pdf": { title: "Word to PDF", endpoint: "/api/convert", accept: ".docx", isText: false, isMulti: false, needsPages: false },
  "xlsx-to-pdf": { title: "Excel to PDF", endpoint: "/api/convert", accept: ".xlsx", isText: false, isMulti: false, needsPages: false },
  "pptx-to-pdf": { title: "PPT to PDF", endpoint: "/api/convert", accept: ".pptx", isText: false, isMulti: false, needsPages: false },
  "merge-pdfs": { title: "Merge PDFs", endpoint: "/api/convert", accept: ".pdf", isText: false, isMulti: true, needsPages: false },
  "split-pdf": { title: "Split PDF", endpoint: "/api/convert", accept: ".pdf", isText: false, isMulti: false, needsPages: true },
  "compress-pdf": { title: "Compress PDF", endpoint: "/api/convert", accept: ".pdf", isText: false, isMulti: false, needsPages: false },
  "ocr-image": { title: "OCR Image", endpoint: "/api/convert", accept: "image/*", isText: true, isMulti: false, needsPages: false },
} as const;

export async function generateMetadata({ params }: { params: { tool: string } }) {
  const tool = TOOLS[params.tool];
  return {
    title: tool ? `${tool.title} — DocuForge` : "Tool — DocuForge",
    description: tool
      ? `Use the ${tool.title} tool to process your files quickly and privately.`
      : "DocuForge tool",
  };
}

export default function ToolPage({ params }: { params: { tool: string } }) {
  const tool = TOOLS[params.tool];
  if (!tool) notFound();
  return <ToolForm tool={{ slug: params.tool, ...tool }} />;
}
