# DocuForge — Complete Build Spec
# Target: launch-ready by October 1, 2026

## Live endpoints
- Frontend: https://docuforgev2-nt74t5xnk-navid12.vercel.app
- Backend: https://docuforge-wix5.onrender.com
- Database: docuforge-db (PostgreSQL)
- Repo: https://github.com/navid909/docuforge

## Required Vercel environment variables (set these first)
- NEXT_PUBLIC_BACKEND_URL = https://docuforge-wix5.onrender.com
- NEXTAUTH_URL = https://docuforgev2-nt74t5xnk-navid12.vercel.app
- NEXTAUTH_SECRET = any secure random string

---

## Backend contract

### Auth
- POST /auth/register
  - Body: { email: string }
  - 201: { id, email, token, premium: false }
  - 409: { error: "User already exists" }
- POST /auth/login
  - Body: { email: string }
  - 200: { id, email, token, premium: boolean }
  - 401: { error: "Login failed" }

### Tools
- POST /api/convert
  - Headers: Authorization: Bearer <token>
  - Body: multipart/form-data
    - tool: string
    - file: binary
    - optional fields per tool
  - 202: { jobId, status: "queued" }
  - 401: { error: string }

- GET /api/status/:jobId
  - Headers: Authorization: Bearer <token>
  - 200: { jobId, status, progress?, result?, error? }
  - Status values: queued | processing | completed | failed

- GET /api/download/:jobId
  - Headers: Authorization: Bearer <token>
  - 200: file download
  - 404: { error: "Result not ready" }

---

## Tool specs

### 1. Image to PDF
- tool slug: image-to-pdf
- POST /api/convert
  - fields: tool=image-to-pdf, file=image
  - worker: img2pdf or sharp/puppeteer render
  - output: single PDF
- status polling every 2s recommended

### 2. PDF to Word
- tool slug: pdf-to-word
- input: .pdf
- output: .docx
- worker: use pdf-parse + docx library

### 3. Merge PDFs
- tool slug: merge-pdfs
- input: multiple .pdf files
- output: merged .pdf
- worker: pdf-lib merge

### 4. Compress PDF
- tool slug: compress-pdf
- input: .pdf
- output: compressed .pdf
- worker: ghostscript or sharp/pdf-lib reduce quality

### 5. OCR Image
- tool slug: ocr-image
- input: image or scanned PDF
- output: .txt or .pdf with text layer
- worker: tesseract.js or external OCR API

---

## Database notes
- Use existing prisma/schema.prisma
- Tables already created via prisma db push
- Add Job model if missing: id, userId, tool, status, input, output, error, createdAt

---

## Frontend pages to verify
- /auth — email sign-in
- /tools — tools list
- /tools/image-to-pdf
- /tools/pdf-to-word
- /tools/merge-pdfs
- /tools/compress-pdf
- /tools/ocr-image
- /dashboard — job history
- /premium — pricing/checkout placeholder
- /pricing — pricing page

Frontend already has routing for these. Main work is tool forms + result/download flow.

---

## Acceptance test checklist
1. Register/login returns token
2. Upload image -> /api/convert returns jobId
3. /api/status/:jobId moves queued -> processing -> completed
4. /api/download/:jobId returns real PDF
5. Repeat for PDF to Word, Merge, Compress, OCR
6. Frontend shows loading, success, and error states
7. Invalid token returns 401
8. Missing file returns 400

---

## Launch blockers
- [ ] All 5 tools working end-to-end
- [ ] Error handling + user feedback
- [ ] Premium placeholder pages functional
- [ ] Mobile responsive check
- [ ] Terms / Privacy / Contact pages
