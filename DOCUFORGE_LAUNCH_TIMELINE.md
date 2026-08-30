# DocuForge — Launch Timeline & Checklist
# Target: October 1, 2026

---

## Week 1: Foundation (Aug 29 – Sep 4)
- [ ] Add Vercel env vars: NEXT_PUBLIC_BACKEND_URL, NEXTAUTH_URL, NEXTAUTH_SECRET
- [ ] Trigger Vercel Manual Deploy
- [ ] Verify frontend loads: https://docuforgev2-nt74t5xnk-navid12.vercel.app
- [ ] Verify backend health: https://docuforge-wix5.onrender.com/health
- [ ] Verify auth endpoints: /auth/register, /auth/login
- [ ] Verify database connected and migrations applied

---

## Week 2: Backend Tools (Sep 5 – Sep 11)
- [ ] Implement /api/convert with multipart file upload
- [ ] Implement /api/status/:jobId polling endpoint
- [ ] Implement /api/download/:jobId file download
- [ ] Build Image → PDF worker (img2pdf / sharp)
- [ ] Build PDF → Word worker (pdf-parse + docx)
- [ ] Build Merge PDFs worker (pdf-lib)
- [ ] Build Compress PDF worker (ghostscript / sharp)
- [ ] Build OCR Image worker (tesseract.js)
- [ ] Add BullMQ queue with Redis
- [ ] Add error handling + timeout logic
- [ ] Add file cleanup / TTL for old jobs

---

## Week 3: Frontend Tools (Sep 12 – Sep 18)
- [ ] Fix auth provider wrapping in layout.tsx
- [ ] Implement /auth page: email sign-in flow
- [ ] Implement /tools page: grid/list of all tools
- [ ] Implement /tools/image-to-pdf: upload form + result/download
- [ ] Implement /tools/pdf-to-word: upload form + result/download
- [ ] Implement /tools/merge-pdfs: multi-file upload + result/download
- [ ] Implement /tools/compress-pdf: upload form + result/download
- [ ] Implement /tools/ocr-image: upload form + result/download
- [ ] Implement /dashboard: job history list
- [ ] Implement /premium: pricing/checkout placeholder
- [ ] Implement /pricing: pricing page
- [ ] Add loading spinners + progress indicators
- [ ] Add error messages + retry logic
- [ ] Add mobile responsive styles

---

## Week 4: Integration Testing (Sep 19 – Sep 25)
- [ ] Test all 5 tools end-to-end
- [ ] Test auth: register → login → token → protected routes
- [ ] Test error cases: invalid token, missing file, bad tool slug
- [ ] Test file size limits + format validation
- [ ] Test concurrent uploads
- [ ] Test mobile experience
- [ ] Fix all bugs found during testing

---

## Week 5: Launch Prep (Sep 26 – Oct 1)
- [ ] Add Terms of Service page
- [ ] Add Privacy Policy page
- [ ] Add Contact / Support page
- [ ] Add cookie consent logic
- [ ] Add analytics (optional)
- [ ] Final security review: no exposed secrets, CORS configured
- [ ] Performance check: page load < 3s, tool processing < 30s
- [ ] Backup database
- [ ] Soft launch: test with real users
- [ ] Fix any last-minute issues
- [ ] **LAUNCH: October 1, 2026**

---

## Critical Path
1. Backend tools MUST be done by Sep 11
2. Frontend tools MUST be done by Sep 18
3. Testing MUST be done by Sep 25
4. Launch prep MUST be done by Oct 1

## Dependencies
- Backend tools depend on: database, Redis, file storage
- Frontend tools depend on: backend API endpoints being live
- Testing depends on: both backend + frontend being complete

## Risk Mitigation
- If backend is delayed: frontend can still be built with mock data
- If Redis is unavailable: use in-memory queue for testing
- If a tool library fails: fallback to simpler implementation
- Buffer 2–3 days before Oct 1 for unexpected issues
