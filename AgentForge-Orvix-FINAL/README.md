# AgentForge

React + Vite + Tailwind CSS + React Flow frontend, built to match the AgentForge UI
mockup (9 screens): Dashboard, Workflow Creation, Generated Workflow Editor (node
graph), Execution & Results, Templates, Workflow History, Empty state, Error state,
and the shared Design System (colors, typography, buttons, nodes).

## Run it

```bash
npm install
npm run server
```

In a second terminal:

```bash
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

To build for production:

```bash
npm run build
npm run preview
```

The API listens on `http://127.0.0.1:4000` and Vite proxies `/api` requests to it.
Without `MONGODB_URI`, application data is stored in
`server/data/agentforge.json` for local development. Copy `.env.example` to
`.env` and set `GEMINI_API_KEY` to enable Gemini generation and sandbox
evaluation. Set `MONGODB_URI` and `MONGODB_DB` to use MongoDB persistence;
`npm run migrate:mongodb` imports existing file data. SMTP settings enable
real password-reset and agent-result emails; `TWILIO_ACCOUNT_SID`,
`TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER` enable SMS notifications. Google OAuth settings enable
Gmail-connected agents, and Slack webhook URLs can be configured on output
nodes. Set `OAUTH_ENCRYPTION_KEY` in production to protect provider tokens.
Deployed agents with schedule triggers are executed by the server scheduler.
Set `PORT`, `HOST`, `CLIENT_ORIGIN`, `API_PUBLIC_URL`, or `VITE_API_URL` to
override defaults. Set `API_PUBLIC_URL` to the public API origin whenever the
frontend and API use different domains. Scheduled agents should run as a
single scheduler instance unless a distributed lock is added.

## What's inside

- **Login** (`/login`) — split-screen entry point with login, sign-up, forgot
  password, show/hide password, and remember-me flows. Authentication uses the
  Node API with scrypt password hashing and bearer-token sessions. Every other route is guarded
  (`src/components/RequireAuth.jsx`), so opening the app starts here.
- **Dashboard** (`/`) — stats, quick actions, recent workflows.
- **Create Workflow** (`/create`) — the prompt box + example chips. With an
  authenticated API session, prompts wait for the backend to generate the
  actual agent graph with Gemini; deterministic templates remain available as
  an offline fallback.
- **Workflow Editor** (`/workflow/:id`) — a real, draggable **React Flow**
  (`@xyflow/react`) canvas with the 5 node types from the design system
  (Trigger / Action / AI Agent / Condition / Output), each colour-coded.
  "Run Workflow" sends the test input to the server-side agent runtime. AI
  steps call Gemini with the previous step's data, output steps perform their
  configured side effect, and the editor displays the persisted run result.
  Deployed agents expose a tokenized webhook endpoint for real event delivery.
- **Templates** (`/templates`) — the 4 ready-made templates; "Use Template"
  generates a workflow straight into the editor.
- **My Agents** (`/agents`) — all created workflows, with the empty state
  when there are none yet. Deploying an agent activates a live webhook endpoint
  and shows its URL in the editor.
- **History** (`/history`) — table of workflows and individual completed runs
  with status/date/duration, filterable by status.
- **Settings** (`/settings`) — local profile, notification preference, saved
  session, and logout controls.

## Checking your configuration

```bash
npm run doctor                      # check SMTP, Gemini and Twilio
npm run doctor -- you@gmail.com     # also send a real test email
```

Each check makes a real request and prints what came back, including which
Gemini models your key can actually use and whether your Twilio number is
SMS-capable. Run it after editing `.env`; a misconfiguration shows up here
instead of surfacing later as a silently simulated notification.

Google sign-in has a demo mode that skips the OAuth handshake entirely and
returns a fixed account. It is only active when `ALLOW_DEMO_OAUTH=true`, and
never in production.

## Notifications

Every output node carries a **channel** (email, Slack or SMS) and a
**destination**. Whatever the user types into that node is where the agent
result is sent:

- **Email** — an address on the node wins; leave it blank to fall back to the
  signed-in account's registered email.
- **SMS** — requires a number in international format (`+919876543210`).
  Delivered through Twilio when `TWILIO_*` is configured.
- **Slack** — requires an `https://hooks.slack.com/...` webhook URL. Slack and
  SMS never fall back to the account email, because an email address is neither
  a webhook nor a phone number.

When a workflow is generated from a prompt — by Gemini or by the template
fallback — the recipient is read straight out of the prompt, so
"summarise my inbox and email me at me@example.com" arrives with that address
already filled in. Anything that is not a genuinely valid destination is
dropped rather than stored.

Validation is shared between the browser and the server
(`src/utils/notify.js`), so a destination accepted in the editor is never
rejected at run time. The node panel has a **Send test notification** button
(`POST /api/notifications/test`) to confirm an address works before deploying,
and `GET /api/notifications/status` reports whether SMTP and SMS are actually
configured.

Delivery results are honest: a run reports `delivered`, `simulated` (the
provider is not configured, so the message was written to the server log), or
`skipped` (account-level notifications are off in Settings). An explicit
recipient typed on a node is always honoured, even when the Settings toggle is
off.

For Gmail SMTP, `SMTP_PASSWORD` must be a 16-character App Password, not the
account password, and 2-Step Verification must be on.

## Backend API

The built-in Node backend provides password hashing, bearer sessions, account
creation/login/password reset confirmation, workflow CRUD, Gemini generation and
execution, tokenized webhook deployment, sandbox scoring, execution history,
notifications, profile updates, preferences, MongoDB persistence, SMTP email,
and IP-based rate limiting. A deployed agent accepts `POST` JSON payloads at
`/api/hooks/:token`; the token is shown in the workflow editor after deployment.
Google OAuth uses `/api/integrations/google/connect` and requires the callback
URL configured in Google Cloud Console to match `GOOGLE_REDIRECT_URI`.
The frontend store synchronizes authenticated workflow mutations to the API.
`GET /api/health` is a liveness check and `GET /api/ready` is the deployment
readiness check. The Gemini, MongoDB, and SMTP credentials are read only by the
server and are never sent to the browser.

## Production deployment

Build the frontend with `npm run build`, run the API with `npm start`, and put
Caddy in front using `deploy/Caddyfile`. Point DNS for the configured domain
to the server; Caddy terminates HTTPS and renews certificates automatically.
Set `TRUST_PROXY=true` when using a trusted reverse proxy so rate limiting can
use the forwarded client address. In production, MongoDB and
`OAUTH_ENCRYPTION_KEY` are required; the API fails closed instead of silently
using local file storage. Never expose port 4000 directly to the public internet.
The API exposes `/api/health` for liveness and `/api/ready` for readiness; use
the latter for process managers and load balancers.

For the configured Windows local setup, run:

```powershell
& C:\Users\Sahil\Downloads\caddy_windows_amd64.exe run --config .\deploy\Caddyfile.local
```

Then open `https://localhost:8443`. Caddy uses a local development certificate;
the browser may require trusting Caddy's local root certificate once.

## Design tokens

Colors, radii and shadows matching the mockup's Design System screen are
defined in `tailwind.config.js` (`primary`, `secondary`, `accent`, `success`,
`warning`, `danger`, `running`, plus `canvas`/`surface`/`ink` for
backgrounds and text). Reuse these utility classes for anything new so it
stays visually consistent.
