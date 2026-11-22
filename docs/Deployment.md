# Production deployment: Vercel, Railway and Supabase

The user selected free hosting options on 16 November 2026. The user subsequently selected Railway source deployment within available free credits. Follow [the budget notes](Deployment-Free.md) for this constraint. The Railway private-image route below requires Pro; do not activate paid plans without authorization.

## Live release

Frontend: https://asignx.vercel.app

API: https://api-production-e7cc8e41.up.railway.app

The live backend is built from isolated source bundles uploaded with the Railway
CLI, within the existing trial/Free credits. It does not pull the private GHCR
images or require a paid registry upgrade. The private Python service has no
public domain. See [current verification and limits](Deployment-Verification.md).
The Render alternative is not in use. No paid plan upgrade was activated.

Production database connections require certificate-verified TLS. Configure
DATABASE_CA_CERT on the API with the public CA certificate from Supabase Database
Settings > SSL configuration > Download certificate. The code accepts either a
multiline PEM or escaped newline sequences. Do not set rejectUnauthorized=false.
The copied Supabase URL may omit SSL settings; production code enforces TLS even
then. DATABASE_URL can also explicitly request sslmode=verify-full. Supply the CA
to trusted migration jobs when their runtime needs it. Recheck certificate validity
when Supabase rotates its CA.

Source upload contexts must include only the corresponding Dockerfile, runtime
sources, manifests, lockfiles and configuration. Include the five verified private
model assets only for recognition. Exclude .env files and installed dependencies.
Use railway up <isolated-directory> --path-as-root with the explicit project,
environment and service. Do not use --new or upload arbitrary ignored local files.

Vercel uses the local client/vercel.json API rewrite and the two public VITE
Supabase settings in production. client/.vercelignore excludes environment files
and local CLI metadata. Deploying from the CLI does not configure Git autodeploys.

## Architecture and current status

Deploy `client` to Vercel, Express to one Railway service, and Python recognition
to a second, private Railway service. Keep Supabase PostgreSQL, Auth and Storage.
Browser `/api` requests go through a Vercel rewrite to Express. Auth and signed
video playback use Supabase directly. Do not move the database or videos to a
container filesystem. Camera frames remain transient.

This repository supplies Docker build definitions, deployment settings, readiness
checks and a Vercel configuration generator. It does not contain hosting account
credentials, a real Railway API hostname, or public copies of private models.
Creating these files is not evidence of a successful cloud deployment. Linux
image builds, live migrations, email delivery, proxy identity and signing latency
must be verified before launch. Do not deploy until the checks below pass.

The API and Python must each have exactly one replica. Python uses one Uvicorn
worker. Both hold camera-session state in memory; restarts interrupt sessions.
Disable Railway serverless sleeping for both services. Keep them in the same
project environment and region, near the Supabase database. No volume is needed
when models are provisioned in the recognition image.

## 1. Local checks

Run from the indicated directories, with dependencies already installed:

```text
client: npm ci
client: npm test
client: npm run lint
client: npm run build
server: npm ci
server: npm test
server: npm run test:recognition
server: npm run test:nlp
server: node scripts/recognition.mjs --test-deployment
```

The server tests use disposable PGlite, not production migrations. Some checks
need loopback HTTP access. A permission failure does not establish a code failure
or a pass. The Python runtime test requires the local interpreter and installed
requirements documented in ASignLive-Recognition.md.

## 2. Build private backend images

Use Docker with Linux containers. Run at repository root. Node is pinned to the
24 major and Python to the locally documented 3.14 major; verify the exact pinned
Python requirements on Linux rather than assuming Windows wheels transfer.

```text
docker build -f server/Dockerfile -t asignx-api:release server
docker build --target migrations -f server/Dockerfile -t asignx-migrations:release server
docker build -f server/Dockerfile.recognition -t asignx-recognition:release server
```

Provision all five assets under `server/private/models` before the recognition
build. They are intentionally Git-ignored. Its Dockerfile verifies their SHA-256
hashes against `server/recognition/model-manifest.json`. An intentional model
upgrade must update and review that manifest alongside the models' metadata.
Never add models or `.env` to Git to make a cloud build work.

API builds exclude the private directory. Recognition builds use their own
Docker context allowlist containing only runtime Python files, requirements,
manifest and model files. No local dependency environment is copied.

Push release-tagged images to a PRIVATE registry you control; avoid mutable
`latest` tags. Anyone able to pull the recognition image can extract its models.
Configure Railway's private registry access through the account UI. Alternatively,
build in secured CI that receives the same private assets. No CI credential or
artifact download mechanism is assumed by this repository.

Smoke-test each Linux image before release. In particular, start Python with a
fresh backend-only recognition token, confirm `/health/ready` returns 200, confirm
unauthenticated `/capabilities` returns 401, then test authenticated session/frame
handling. The startup check loads both ONNX graphs, constructs/closes a MediaPipe
detector, and loads the SymSpell dictionary before becoming ready. CPU inference
is the implemented provider; there is no GPU requirement in the code.

## 3. Supabase setup and release migrations

Use `server/README.md` as the schema and permission standard. Before changing an
existing production project, back it up and verify its migration journal. Never
replace the migration runner with `drizzle-kit push` or delete migration history.

Use a trusted one-off release environment with `asignx-migrations:release`:

```text
npm run db:migrate
npm run db:check
```

Inject DATABASE_URL securely; do not put its value in shell history, image build
arguments or source. Run the migration once, not independently on every API
startup. The migration image retains tsx, drizzle-kit, schema and SQL history;
the API runtime image does not. Use direct or session-pooler mode for migrations.
Use the fresh connection string from Supabase Connect, percent-encode the password,
and require TLS. Verify certificate trust on the Linux image without disabling
certificate validation. Pool size is five connections per API process.

Provision `server/storage/learning-media.sql` separately using a trusted SQL
connection. It creates a private bucket with a 20 MiB MP4 limit and admin upload,
published playback and unreferenced-upload cleanup policies. Retain existing RLS,
confirmed-user profile triggers, grading and role checks. Verify intended content
and an admin account before launch; do not grant admin via signup metadata.

In Supabase Auth configure the actual frontend Site URL, `/auth/callback` URLs
(including supported internal-return query variants) and `/reset-password` URLs.
Allow only intended production and staging hosts. Configure verified SMTP and
test real confirmation, resend, login and recovery email delivery.

## 4. Railway services

Create a project/environment with these services. Start with tested resource
limits; measure memory with active MediaPipe sessions rather than assuming the
small model file sizes imply a small runtime footprint.

### Recognition

Deploy the private recognition image. Do not generate a public domain. Set:

```text
RECOGNITION_INTERNAL_TOKEN=<fresh-long-random-secret>
RECOGNITION_HOST=::
PORT=8001
```

Use the image's default start command and one replica. Configure readiness path
`/health/ready`, timeout 180 seconds, restart policy ON_FAILURE with three retries.
`server/railway.recognition.json` records these deploy settings; apply them through
the dashboard if the image-source service is not linked to repository config.
Check dual-stack binding in the deployed environment.

### API

Deploy the API image, or build from Git with root directory `/server` and Dockerfile
`Dockerfile`. For Git deployment explicitly set the Railway config file path to
`/server/railway.api.json`; config paths do not inherit the service root directory.
The API image has a default start command; do not run a development server.

Set the following as service variables:

```text
NODE_ENV=production
DATABASE_URL=<validated-Supabase-runtime-connection-string>
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=<same-project-public-key>
RECOGNITION_INTERNAL_TOKEN=<same-secret-as-Python>
RECOGNITION_URL=http://recognition.railway.internal:8001
RECOGNITION_ALLOWED_ORIGINS=https://YOUR-FRONTEND-DOMAIN
```

Replace `recognition` with the actual Railway service's private DNS name. Do not
copy the local Windows `RECOGNITION_PYTHON` value. Let Railway supply the API PORT.
Generate an HTTPS public domain for the API. Verify `/health/ready` (database) and
`/health/recognition` (private model service) both return 200. The deployment
healthcheck is database readiness; separately monitor recognition continuously.

### Client identity behind proxies: mandatory hosted check

The session-start limiter uses Express `req.ip`. Forwarded IPs are untrusted by
default. `TRUST_PROXY_CIDRS` accepts explicit proxy IPs or CIDR ranges, not `true`,
hop counts, or global `/0` ranges. Configure only after verifying the actual
Railway/Vercel proxy chain and which proxies overwrite/append forwarded headers.
Do not guess proxy ranges or blindly trust all private networks.

Verify two independent clients get separate rate-limit identities and spoofed
forwarded headers cannot change that identity via either the direct Railway URL
or Vercel. Until verified, users may share a proxy rate-limit bucket. CIDR trust
alone is insufficient if a trusted upstream preserves attacker-controlled headers;
use provider-supported edge identity/ingress controls if necessary. Origin checks
are not authentication or protection against non-browser clients.

## 5. Vercel

After the real API domain exists, run from `client`:

```text
node scripts/configure-hosting.mjs https://YOUR-REAL-API.up.railway.app
```

Commit the generated `client/vercel.json` before importing/deploying the project.
Do not generate it inside the build command: Vercel reads routing config earlier.
The API rewrite comes before the SPA fallback and retains the `/api` prefix.
API responses explicitly use no-store; do not enable rewrite caching.

Import the correct repository branch. Set root directory `client`, Vite framework,
install `npm ci`, build `npm run build`, output `dist`, Node 24. Set only:

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<same-project-public-key>
```

Vite embeds these public values at build time. Never add DATABASE_URL, a Supabase
service-role/secret key or the recognition token. Deploy, obtain the final HTTPS
frontend origin, then set that exact origin in Express recognition origins and
Supabase redirect settings. Keep preview projects on staging data unless explicitly
configured and tested for production use.

## 6. Launch acceptance and operations

- Test public content, deep-link refresh, confirmation, resend, login, logout,
  password recovery and account isolation on the final origin.
- Verify admin video upload, signed playback, enrollment, grading and duplicate
  submissions retain their existing authorization and idempotency behavior.
- Test real-camera Live and lesson recognition, reset/stop/retry, unavailable Python,
  two clients, and restart recovery. Python permits 16 sessions and two concurrent
  frame jobs; these are limits, not a measured capacity claim.
- Check JPEG requests and Authorization headers survive the Vercel rewrite. Monitor
  round-trip latency: 15 FPS can mean 54,000 uploads per active user-hour.
- No frames, bearer tokens, service secrets or capability session IDs should appear
  in application logs. Review provider access logging separately.
- Add uptime and recognition monitoring. Railway deployment healthchecks do not
  provide ongoing monitoring. Set cost alerts; hard spending caps can stop services.
- Keep database and video backups, image/model versions and a rollback procedure.
  An API rollback does not reverse database migrations; prefer compatible changes.

## Official references

- https://vercel.com/docs/frameworks/frontend/vite
- https://vercel.com/docs/routing/rewrites
- https://docs.railway.com/deployments/monorepo
- https://docs.railway.com/builds/dockerfiles
- https://docs.railway.com/networking/private-networking
- https://docs.railway.com/networking/private-networking/library-configuration
- https://docs.railway.com/deployments/healthchecks
- https://supabase.com/docs/guides/database/connecting-to-postgres

Pricing and limits change. Check the provider's current pricing pages before
selecting plans. Vercel Hobby is intended for personal noncommercial use; Railway
is usage-billed, and Supabase video egress is separate from Railway/Vercel usage.
