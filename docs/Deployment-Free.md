# Free hosting option for ASignX demonstrations

CURRENT CHOICE: The user switched back to Railway on 16 November 2026 while keeping the free-only budget. Deploy from isolated local source bundles with the Railway CLI, including the private model files only in the recognition bundle. Do not use private GHCR pulls, which require Pro. The available trial/Free credits are finite and do not establish always-on free hosting. No paid upgrade is authorized.

The Render instructions below are an alternative that the user did not select.

Budget constraint selected by the user on 16 November 2026: use free options;
do not upgrade Railway to Pro or activate a paid compute plan.

Use Vercel Hobby for the noncommercial frontend, two Render Free web services
for Express and Python recognition, and Supabase Free for existing PostgreSQL,
Auth and Storage. This is a candidate for a small demonstration, not established
production capacity or always-on hosting.

## Why this differs from the Railway plan

Railway's private registry credentials require Pro. Its trial is $5 for up to
30 days; the subsequent Free plan provides $1 of credit per month. Neither is
a dependable zero-cost always-on budget for the whole backend. Existing Docker
images remain useful: Render documents support for private GHCR images.

Do not substitute public model-containing images to bypass a hosting-plan limit.
Hugging Face's current Spaces overview also says creating Docker/Gradio compute
Spaces requires a paid plan even though CPU Basic hardware has no hourly charge.

## Render limitations

- 750 free running hours are shared by the workspace each calendar month. Two
  services cannot both run continuously all month within this allowance.
- Services sleep after 15 minutes without inbound traffic. Wake-up takes about
  a minute. Existing recognition calls time out after 12 seconds, so a sleeping
  upstream can cause temporary unavailable responses until it finishes waking.
- Free web services have limited CPU and 512 MB RAM. A local recognition startup,
  blank-frame inference, NLP, reset and cleanup smoke check passed under a 512 MB
  Docker cap. This does not prove capacity for many camera sessions or performance
  on Render's shared CPU allocation.
- Recognition sessions are memory-only and disappear on restart or sleep. Keep
  one instance and one Python worker. Test with one signer before expanding use.
- Disk is ephemeral. Continue using Supabase for durable data and videos.
- Render explicitly advises against using its Free instances for production.

## Image configuration

Use the private package paths under the authenticated `ayawton` GHCR account:

```text
ghcr.io/ayawton/asignx-api:20261116-validated
ghcr.io/ayawton/asignx-recognition:20261116-validated
```

In Render's service-creation form choose Existing Image and the Free compute
plan explicitly. Private registry access uses a GitHub classic token with only
read:packages. Enter it directly in Render; do not put it in Git, a URL or chat.
Do not reuse the publishing token unless its broader scope is explicitly accepted.

Create recognition as a Free WEB service, not a paid Private Service. Configure:

```text
RECOGNITION_HOST=0.0.0.0
PORT=10000
RECOGNITION_INTERNAL_TOKEN=<fresh-long-shared-secret>
```

Keep the Docker image's default command. Configure health check `/health/ready`.
Its public URL is protected by the internal token for inference and NLP; model
assets remain unserved. Only Express should call it. The health route contains
no model or session data. Do not expose the token in frontend configuration.

Create the API as a second Free web service with these backend-only variables:

```text
NODE_ENV=production
DATABASE_URL=<validated-Supabase-runtime-URL>
SUPABASE_URL=<matching-project-HTTPS-URL>
SUPABASE_PUBLISHABLE_KEY=<matching-project-public-key>
RECOGNITION_URL=https://YOUR-RECOGNITION-SERVICE.onrender.com
RECOGNITION_INTERNAL_TOKEN=<same-shared-secret>
RECOGNITION_ALLOWED_ORIGINS=https://YOUR-FRONTEND-DOMAIN
```

Let Render supply the API PORT. Use `/health/ready` for database readiness and
check `/health/recognition` separately. Use the recognition service's public
HTTPS URL so normal requests can wake it from sleep; do not assume free private
networking or publicly accessible raw model files.

Once the API has its real domain, run the existing client hosting generator with
that origin before deploying Vercel. Configure the exact frontend origin in the
recognition allowlist and Supabase Auth redirects. Follow Deployment.md for
migration safety, Storage policies, email checks and proxy identity validation.

Use the migration image as a trusted local one-off command when needed; do not
create a third always-running Render service just to run migrations. No production
migration has been performed by these local container tests.

## References checked on 16 November 2026

- https://render.com/docs/free
- https://render.com/docs/deploying-an-image
- https://docs.railway.com/builds/private-registries
- https://docs.railway.com/pricing/free-trial
- https://huggingface.co/docs/hub/spaces-overview

Account creation, Render deployment, Vercel deployment, real email confirmation,
hosted camera performance, concurrency and final proxy trust remain to be verified.
