# Coursada — Full Website Specification & Build Prompt

This document is the complete master specification for the Coursada online course
platform. It is written so that an engineering team (or an AI agent) could rebuild
the entire product from this file alone. Everything described here **is implemented
in this repository and deployed** to Supabase project `uootbtclscecwaumcelj`.

---

## 1. Product Vision

Build the **easiest online course platform in Somalia**:

- The **admin** should feel like they're uploading to YouTube Studio — create a
  course in 10 minutes without ever seeing the words S3, bucket, or key.
- The **student** should feel like they're watching Netflix/YouTube — browse,
  preview free lessons, pay with EVC Plus or ZAAD from their phone, and watch
  with progress that resumes automatically.
- **Student-first**: students are the customers. If students love it, teachers come.

Design feeling: Linear's cleanliness + Notion's natural editing + GitHub's clear
sidebar + YouTube Studio's friendly uploads. Every screen reduces decisions.

---

## 2. Core Security Problem (and Solution)

Videos must be private. Only paying students may watch. The browser must NEVER
hold Contabo secret keys.

```
Browser ──► Supabase Auth (JWT) ──► Edge Function ──► checks purchase/preview/admin
                                         │
                                         ▼
                              Presigned URL (expires 1h)
                                         │
Browser ◄────────────────────────────────┘  plays video directly from Contabo
```

- Contabo bucket is **private**. No permanent public URLs exist.
- The database stores `video_key` = object path (`videos/<course>/<lesson>/file.mp4`),
  **never** a full URL — so buckets/CDNs/domains can change without breaking data.
- Signed URLs die after 1 hour → shared links stop working → piracy contained.
- Payments are confirmed **server-side only**. Clients have no INSERT/UPDATE
  policy on `purchases`; only the `create-payment` edge function (service role)
  writes them.

## 3. Architecture (five systems)

```
            Browser (React 19 + TS SPA)
                 │
    ┌────────────┴─────────────┐
    ▼                          ▼
Supabase API              Edge Functions (Deno)
(Postgres + Auth +        - create-upload-url
 Storage + RLS)           - get-video-url
    │                     - create-payment
    │                          │
    ▼                          ▼
Supabase Storage          Contabo Object Storage
(thumbnails, PDFs —       (PRIVATE bucket, videos only,
 small files only)         S3-compatible, presigned access)
                               +
                          WaafiPay API (EVC/ZAAD mobile money)
```

## 4. Technology Stack

| Layer      | Choice                                                    |
|------------|-----------------------------------------------------------|
| Build      | Vite 6 + TypeScript 5 (strict)                             |
| UI         | React 19, React Router 7 (SPA, BrowserRouter)              |
| Data       | TanStack Query 5 (retry: false, staleTime 60s)             |
| Auth state | Zustand 5 (`stores/authStore.ts`)                          |
| Forms      | React Hook Form 7 + Zod 3 (`schemas/*`)                    |
| Backend    | Supabase: Postgres 17, Auth, Storage, Edge Functions       |
| Videos     | Contabo Object Storage (S3-compatible), presigned via aws4fetch |
| Payments   | WaafiPay `API_PURCHASE` (direct mobile-money charge)       |

## 5. Repository Structure (feature-oriented, service layer)

```
src/
  lib/          supabase.ts (client + 15s timeout + error mapping)
                queryClient.ts (no stacked retries)
                functions.ts (edge fn invoke + FunctionsHttpError body parsing)
  types/        db.ts (all row types; SyllabusModule etc.)
  schemas/      auth.schema.ts, course.schema.ts (Zod — every form validates)
  stores/       authStore.ts (session, profile, isAdmin, initAuth)
  services/     courses / modules / lessons / purchases / progress /
                video / upload / storage / payment / profile
                → UI NEVER calls supabase.from() directly
  components/   Layout, ProtectedRoute+AdminRoute, Spinner, ErrorMessage,
                Pagination, CourseCard, admin/CourseForm, admin/CurriculumEditor
  pages/        Catalog, CourseDetail, Login, Signup, Dashboard, Profile,
                Checkout, Player, NotFound,
                admin/AdminCourses, admin/CourseCreate, admin/CourseEditor,
                admin/LessonEditor
supabase/
  migrations/   5 SQL migrations (schema, RLS, storage, seed, hardening)
  functions/    create-upload-url / get-video-url / create-payment
```

Architecture rules enforced:
- Feature services own all Supabase queries (no SQL details in components).
- Shared Zod schemas between forms.
- Optimistic updates for admin rename/reorder with rollback on error.
- Soft deletes on courses (`deleted_at`), never hard delete.
- Course status lifecycle: `draft → published → archived`.
- Purchases status set: `pending, processing, completed, failed, expired, cancelled, refunded`.
- Every edge function returns `{ success, data, error: { code, message } }`.

## 6. Data Model (Postgres)

- **profiles** — `id (auth.users FK), full_name, role student|admin, avatar_url`.
  Auto-created by `handle_new_user()` trigger on signup. A trigger
  (`prevent_role_change`) blocks self-promotion to admin.
- **courses** — `title, description, category, price numeric, currency,
  thumbnail_url, status draft|published|archived, created_by, deleted_at`.
- **modules** — `course_id, title, sort_order`.
- **lessons** — `module_id, course_id, title, description, video_key (Contabo
  path or NULL), duration_seconds, is_preview, sort_order, resources jsonb
  [{name,url}]`.
- **purchases** — `user_id, course_id, amount, currency, status, payment_channel
  EVC|ZAAD, payment_reference, phone_number`. Partial unique index: one
  `completed` purchase per (user, course).
- **progress** — `user_id, lesson_id, course_id, last_position_seconds,
  completed`, unique (user_id, lesson_id).

Helper functions (SECURITY DEFINER, fixed search_path):
- `is_admin()` / `has_purchased(course_id)` — used by RLS and the client.
- `get_course_syllabus(course_id)` — public syllabus RPC returning module +
  lesson titles/durations/preview flags but **never `video_key`** (safe for
  anonymous course-detail pages).

## 7. RLS Matrix

| Table     | anonymous            | student                                  | admin |
|-----------|----------------------|-------------------------------------------|-------|
| courses   | read published       | read published                             | all   |
| modules   | read (published course) | read (published course)                | all   |
| lessons   | — (use syllabus RPC) | preview lessons + purchased courses        | all   |
| purchases | —                    | read own (writes: edge function only)      | read all |
| progress  | —                    | full CRUD on own rows                      | —     |
| profiles  | —                    | read/update own (role change blocked)      | read all |

Storage: buckets `thumbnails` + `resources` are public-read; only admins can
write. Videos are NOT in Supabase Storage.

## 8. Edge Functions (the only 3 backend endpoints)

All: CORS headers, POST+OPTIONS, internal JWT verification via
`admin.auth.getUser(jwt)`, consistent JSON envelope, secrets read from
Supabase function secrets.

1. **create-upload-url** — verifies admin role → validates lesson exists →
   builds `video_key = videos/{courseId}/{lessonId}/{ts}-{safeName}` →
   presigned **PUT** (aws4fetch SigV4 query-signing, 1h expiry) → returns
   `{upload_url, video_key}`. Client uploads via XHR (progress + cancel), then
   saves `lessons.video_key` (admin RLS).
2. **get-video-url** — verifies user → loads lesson + course → entitlement =
   admin OR (published AND is_preview) OR (published AND completed purchase) →
   presigned **GET** (1h) → `{url, expires_in}`.
3. **create-payment** — verifies user → loads course (price from DB, never
   client) → rejects if already purchased → free course: instant completed
   purchase → paid: inserts `pending` purchase → calls WaafiPay
   `API_PURCHASE` (`paymentMethod MWALLET_ACCOUNT`, phone normalized to
   `252…`, `APPROVED`/`2001` = success) → marks purchase
   `completed`+reference or `failed` → returns result. USSD approval can take
   up to ~2 minutes; the client shows a "check your phone" waiting state.

WaafiPay lessons baked in: use `API_PURCHASE` (NOT `HPP_PURCHASE` which demands
`hppKey`); accept both `WAAFI_*` and `WAAFIPAY_*` secret names; client parses
`FunctionsHttpError.context` body so real error messages surface.

## 9. Environment Variables

Frontend `.env` (safe, gitignored; `.env.example` committed):
```
VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY,
VITE_CONTABO_ENDPOINT, VITE_CONTABO_BUCKET
```

Edge Function secrets (server only — set via `supabase secrets set` or dashboard):
```
CONTABO_ENDPOINT, CONTABO_ACCESS_KEY, CONTABO_SECRET_KEY,
CONTABO_TENANT_ID, CONTABO_BUCKET, CONTABO_REGION (default "default"),
WAAFI_MERCHANT_UID, WAAFI_API_USER_ID, WAAFI_API_KEY
```
(`SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.)

## 10. Main User Flows

**Student**: Catalog (search title/description/category + category chips +
pagination, 9/page) → Course detail (syllabus via RPC, price, free-preview
buttons) → Login/Signup → Checkout (EVC/ZAAD + phone → USSD push → unlock) →
Player (signed URL, resume position, save progress every 10s, ✓ on ended,
auto-advance, prev/next, outline sidebar with 🔒 locks, "X of Y completed") →
Dashboard (continue learning, progress bars) → Profile.

**Admin wizard**: Step 1 Course details (title/description/category/price) →
Step 2 Curriculum (folder-style modules ▶/▼, inline rename, ↑↓ reorder
(optimistic), add lesson by title = save-first) → Lesson editor (description,
☑ Free Preview, video upload: choose file → presign → direct PUT with progress
% + cancel → video_key saved; resources to Supabase Storage) → Step 3 Publish
(checklist: modules/lessons/videos/thumbnail → 🚀 Publish). Admin list with
Publish/Unpublish/soft-Delete.

## 11. Network Discipline

- Every course/database read uses `AbortSignal.timeout(15000)` — 15s cap.
- TanStack Query `retry: false` — no stacked retries.
- Timeouts/network failures map to clear user messages ("The request timed
  out. Please check your internet connection…") with a Try-again button.
- Signed video URLs cached 45 min (staleTime) and refetched before the 60 min
  expiry.

## 12. Build Order (dependency-driven)

1. DB schema + RLS → 2. Auth → 3. Catalog → 4. Preview playback →
5. get-video-url + progress → 6. Upload pipeline → 7. Payments →
8. Dashboard/Admin → 9. Deploy.

## 13. Deployment

- Frontend: static `dist/` (Vercel/Netlify/any static host). `vercel.json`
  rewrites all routes to `index.html` (SPA).
- Supabase: migrations in `supabase/migrations/`, functions in
  `supabase/functions/` (deployed), secrets via CLI/dashboard.
- Contabo: private bucket + CORS allowing `PUT, GET` from dev
  (`http://localhost:5173`) and the production origin.

## 14. Current Deployment State — FULLY CONFIGURED

- Supabase project: `coursada` (`uootbtclscecwaumcelj`, eu-west-1) —
  schema, RLS, storage buckets, demo course seeded, 3 functions ACTIVE.
- `.env` filled with the real URL + anon key.
- Admin account: ismailbulbul381@gmail.com (role = admin).
- Contabo: private bucket `coursada-videos` on `https://usc1.contabostorage.com`
  (region string `default`), CORS applied, presigned PUT/GET round-trip verified,
  anonymous access confirmed blocked.
- Edge Function secrets set via `supabase secrets set`: 5× `CONTABO_*` +
  3× `WAAFI_*` (values live only in the Supabase secret store, never in this repo).
- All three functions smoke-tested: proper `{success:false, error}` envelopes
  with 401 for unauthenticated calls.
- Remaining: deploy `dist/` to a static host when ready (see README §Deploy).
