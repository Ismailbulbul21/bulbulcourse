# BulbulCourses — Online Course Platform

Sell online courses securely: private videos on Contabo, payments with EVC Plus /
ZAAD via WaafiPay, everything else on Supabase. Full specification: [PROMPT.md](PROMPT.md).

**Live backend:** Supabase project `coursada` — ref `uootbtclscecwaumcelj` (eu-west-1).
Database, RLS, storage buckets, a demo course, and all three edge functions are
already deployed.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production bundle in dist/
```

`.env` is already filled in (gitignored). New machines: copy `.env.example` → `.env`.

## First-time setup checklist

### 1. Create your admin account

Sign up in the app, then promote yourself (SQL Editor in the Supabase dashboard):

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'YOUR_EMAIL_HERE');
```

> Tip: while testing, turn off "Confirm email" under Authentication → Providers →
> Email so signups log in instantly.

### 2. Set the video storage secrets (Contabo)

✅ **Already provisioned for this project**: the private bucket `coursada-videos`
exists at `https://usc1.contabostorage.com` (US Central; region string `default`)
with CORS configured, and the presigned PUT/GET round-trip was verified.

For a new environment, create a **private** bucket, generate S3 credentials, then:

```bash
supabase secrets set \
  CONTABO_ENDPOINT=https://usc1.contabostorage.com \
  CONTABO_ACCESS_KEY=your_access_key \
  CONTABO_SECRET_KEY=your_secret_key \
  CONTABO_BUCKET=coursada-videos \
  CONTABO_REGION=default \
  --project-ref uootbtclscecwaumcelj
```

(Alternatively: Dashboard → Edge Functions → Secrets.)

### 3. Configure Contabo bucket CORS

✅ **Already applied** to `coursada-videos` (origins `*`, methods GET/PUT/HEAD).
Restrict `AllowedOrigins` to your production domain later if you want.

Browser uploads/playback hit Contabo directly with presigned URLs, so the bucket
needs CORS for your origins:

```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["http://localhost:5173", "https://your-production-domain.com"],
      "AllowedMethods": ["GET", "PUT", "HEAD"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

Apply with any S3 client, e.g. AWS CLI:
`aws s3api put-bucket-cors --bucket your_bucket_name --endpoint-url https://eu2.contabostorage.com --cors-configuration file://cors.json`

### 4. Set the payment secrets (WaafiPay)

From your WaafiPay merchant dashboard (API settings):

```bash
supabase secrets set \
  WAAFI_MERCHANT_UID=Mxxxxxxx \
  WAAFI_API_USER_ID=xxxxxxx \
  "WAAFI_API_KEY=API-xxxxxxxxxxxx" \
  --project-ref uootbtclscecwaumcelj
```

Until secrets are set, uploads/payments return a clear "not configured yet"
message — everything else works.

## How it works (30 seconds)

- **Videos** live only in a private Contabo bucket. The DB stores `video_key`
  paths, never URLs. Playback asks the `get-video-url` edge function, which
  checks purchase / free-preview / admin and returns a signed URL that dies in
  1 hour.
- **Uploads**: admin picks a file → `create-upload-url` (admin-only) returns a
  presigned PUT → browser uploads straight to Contabo with a progress bar →
  `video_key` saved on the lesson.
- **Payments**: `create-payment` creates a *pending* purchase, charges the
  wallet via WaafiPay `API_PURCHASE` (USSD push to the phone), and marks the
  purchase *completed* server-side. Clients cannot write purchases at all (RLS).
- **RLS** protects every table; students only ever see their own purchases and
  progress.

## Testing the flows

1. **Catalog/preview**: open the site logged out — the seeded demo course shows;
   its syllabus loads via the public RPC.
2. **Admin**: log in as admin → Admin → open the demo course → Curriculum →
   open a lesson → upload a small MP4 (needs step 2+3 above) → Publish.
3. **Student purchase**: sign up with a second account → open the course →
   Buy → enter your EVC/ZAAD number → approve the USSD prompt on the phone →
   the course unlocks and progress starts saving.
4. **Function logs**: Dashboard → Edge Functions → *function* → Logs
   (look for "Calling WaafiPay", "WaafiPay response", "Presigned upload created").

## Deploy to production (Vercel)

1. Push to GitHub, then import the repo in Vercel (framework preset: **Vite**).
2. **Set the environment variables in Vercel** (Project → Settings →
   Environment Variables) — `.env` is gitignored so Vercel never sees it.
   Without these the deployed site shows a blank page:
   - `VITE_SUPABASE_URL` = `https://uootbtclscecwaumcelj.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = (the anon key from your local `.env` /
     Supabase Dashboard → Settings → API)
   - `VITE_CONTABO_ENDPOINT` = `https://usc1.contabostorage.com`
   - `VITE_CONTABO_BUCKET` = `coursada-videos`
3. Redeploy after adding the variables. SPA rewrites are already configured in
   `vercel.json`.
4. Add your Vercel domain to Supabase Auth → URL Configuration (Site URL +
   redirect URLs) so login/signup emails point to production.
   (Contabo CORS already allows all origins, so uploads/playback work as-is.)
3. Migrations/functions live in `supabase/` — for a fresh project:
   `supabase db push` and `supabase functions deploy <name>`, then re-set secrets.

## Repo map

```
src/services/   all Supabase/edge-function calls (UI never queries directly)
src/pages/      student pages + pages/admin/ (wizard, curriculum, lesson editor)
src/stores/     Zustand auth store
supabase/       migrations + the 3 edge functions (deployed)
PROMPT.md       full master specification of the platform
```
