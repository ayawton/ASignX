# ASignX deployment verification — 16 November 2026

## Live services

- Frontend: https://asignx.vercel.app — Vercel Hobby, production deployment READY.
- API: https://api-production-e7cc8e41.up.railway.app — Railway source deployment SUCCESS.
- Recognition: Railway service `recognition`, private IPv6 networking on port 8001;
  no public domain. One replica, one Uvicorn worker.
- Data, Auth and video Storage: existing Supabase Free project ASignX-Database.
- Railway project: https://railway.com/project/5d6bdd41-2be9-4609-ac61-6a3caa90acfa

The owner resumed the paused Supabase project and rotated its database password.
The rotated credentials passed the documented read-only readiness check and were
updated on Railway using stdin, without logging their values. No migrations,
application-data changes, commits or Git pushes were required.

## Verified

| Check | Result |
|---|---|
| Frontend tests, lint and build | Passed during preparation |
| Backend tests and build | 40 passed; repeated successfully after production TLS changes |
| Linux backend suite | 40 passed before the final TLS-only source change |
| Python recognition, NLP and readiness suite | All 24 passed on Windows and Linux |
| Private model integrity | All five SHA-256 hashes matched |
| Linux startup and private service integration | Passed; EGL/GLES native dependencies included |
| Recognition with a 512 MB cap | Basic startup, synthetic frame, NLP and cleanup passed; not a load test |
| Supabase readiness | Connected; missing, unprotected and legacy arrays all empty |
| Production database TLS | Certificate validation enforced by code; official Supabase CA configured on Railway; actual Node TLS socket reported encrypted and authorized |
| API readiness after final TLS rollout | `/health/ready` and `/health/recognition` both returned ready=true |
| Vercel source upload | 108 frontend files validated; environment files, local OIDC metadata and private model files excluded |
| Hosted routes | Home, login, auth callback, password reset and Live returned HTML 200 |
| Published content | Frontend `/api/courses` rewrite returned JSON 200 with no-store |
| Protected API routes | Unauthenticated profile and admin requests returned 401 |
| Browser guest protection | Progress redirected to `/login?next=%2Fprogress` |
| Recognition origin checks | Untrusted origin rejected 403; production origin accepted |
| Complete hosted frame path | Synthetic blank JPEG passed through Vercel, Express and private Python; no false hands or emissions |
| Hosted reset, NLP and cleanup | Passed; HXLLO suggested HELLO; temporary session deleted |
| Video Storage configuration | Private learning-media bucket, 20 MiB MP4 limit and all three expected policies present |
| Production Auth URL settings | Site URL is https://asignx.vercel.app; callback and reset-password redirects added; existing localhost redirects retained |

Latest verified API TLS deployment: `14d2a695-f1c9-4640-a55c-463c31d428b5`.
Vercel deployment: `dpl_E8xBSVYwhd5ESsRecAq7y9ZDcVPx`.

## Credentials, models and release method

A preliminary Docker env-file diagnostic mishandled quoted values and printed the
old database URL. The owner subsequently rotated the password. Later diagnostics
withhold raw credential-bearing errors. Production uses certificate verification,
not `rejectUnauthorized: false`. DATABASE_CA_CERT contains the public CA linked
by the owning Supabase dashboard; it is not a private key.

Private GHCR snapshots were published and individually confirmed private:
`ghcr.io/ayawton/asignx-api:20261116-validated`,
`ghcr.io/ayawton/asignx-recognition:20261116-validated`, and
`ghcr.io/ayawton/asignx-migrations:20261116-validated`.
These predate the final API TLS change. The live Railway services instead build
from isolated local source bundles, including private model assets only in the
recognition bundle. This avoids Railway's paid private-registry credential feature.

The release is manual, not Git-autodeployed. Local source changes remain
uncommitted. Future backend changes need another source upload; a Git push alone
does not update these services. Regenerate the isolated bundle from current code
and verify models and exclusions before uploading. Never upload the whole local
tree with `--no-gitignore` just to include model files.

## Remaining practical limits

- No paid hosting upgrade was activated. Railway uses available trial/Free credits;
  this is not a promise of indefinitely free always-on hosting. Monitor usage.
- Real-account successful login, confirmation/recovery inbox delivery, real camera
  signing, administrator video uploads and multi-user concurrency still need user
  acceptance checks. No test emails or user accounts were created here.
- Per-client rate-limit identity behind the Vercel/Railway proxy chain is not
  established. TRUST_PROXY_CIDRS remains unset, so forwarded addresses are not
  blindly trusted; multiple users can share a proxy bucket.
- Sessions are memory-only. Restarts interrupt camera sessions. Existing limits
  of 16 Python sessions and two frame jobs are not a demonstrated capacity claim.
- Provider log policies, ongoing monitoring, backups and cost alerts are operational
  follow-up work. No frames or recognition history were saved by smoke tests.
