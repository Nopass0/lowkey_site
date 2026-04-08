# Bogdan — Personal Productivity Workspace

A self-hosted personal productivity suite running at **bogdan.lowkey.su**.

Built on a Go backend with a Next.js frontend, authenticated exclusively via
Telegram OTP, and sharing the BitNet LLM instance that powers the main lowkey
platform.

---

## Architecture

```
                        Internet
                           │
                    ┌──────▼──────┐
                    │    nginx    │  bogdan.lowkey.su
                    │  (TLS/SSL)  │  cert: Let's Encrypt
                    └──┬──────┬───┘
                       │      │
            /api/*     │      │  /*
     ┌─────────────────┘      └────────────────┐
     ▼                                          ▼
┌──────────────┐                        ┌──────────────┐
│  Go Backend  │  :8090                 │  Next.js 14  │  :3210
│  (Docker)    │◄──────────────────┐    │  (Docker)    │
└──────┬───────┘                   │    └──────────────┘
       │                           │
       │  internal                 │ depends_on (healthy)
       │                           │
  ┌────▼────┐   ┌──────────┐  ┌───┴────────┐
  │ VoidDB  │   │ BitNet   │  │  Telegram  │
  │ :7700   │   │ :8080    │  │  Bot API   │
  └─────────┘   └──────────┘  └────────────┘
  (shared)      (shared, host) (OTP auth)
```

---

## Features

### Auth — Telegram OTP Login
Access to the entire workspace is restricted to an allowlist of Telegram user
IDs (`BOGDAN_TELEGRAM_USER_IDS`). The login flow:
1. User enters their Telegram username on the login page.
2. The Go backend sends a one-time code via the Telegram bot.
3. The user pastes the code; the backend issues a signed JWT.
4. All subsequent API calls carry the JWT in `Authorization: Bearer <token>`.

No passwords are stored. Sessions expire according to `JWT_SECRET` signing.

### Mail — IMAP/SMTP Email Client
A full-featured email client backed by real IMAP/SMTP connections.
- Multi-folder browsing (Inbox, Sent, Drafts, Trash, custom labels)
- Compose with rich-text editor; send via SMTP
- Thread grouping and search
- Attachment upload/download (stored via the Files module)
- Configured via `MAIL_IMAP_HOST`, `MAIL_IMAP_PORT`, `MAIL_SMTP_HOST`,
  `MAIL_SMTP_PORT`, `MAIL_DOMAIN`

### Tasks — Kanban Board
A drag-and-drop project board:
- Multiple boards per workspace
- Columns: Backlog, In Progress, Review, Done (customisable)
- Cards with title, description, due date, priority, and file attachments
- Keyboard shortcuts for moving cards between columns
- Data persisted in VoidDB

### Notes — Obsidian-style Markdown Editor
A local-first markdown notebook:
- Bidirectional `[[wikilinks]]` between notes
- Graph view showing note connections
- Syntax-highlighted code blocks
- Export to PDF / plain Markdown
- Full-text search across all notes
- Front-matter YAML metadata support
- Data stored in VoidDB; raw `.md` files optionally synced to Files

### Files — Cloud File Storage
A personal cloud drive:
- Upload / download / rename / delete files and folders
- Drag-and-drop uploads; paste from clipboard
- Inline preview for images, PDFs, plain text, and markdown
- Shared file links (time-limited or permanent)
- Stored under `UPLOAD_DIR` (mounted into the backend container)
- Max upload size: 100 MB per file (configurable via nginx `client_max_body_size`)

### AI — BitNet LLM Chat Assistant
An OpenAI-compatible chat interface powered by the shared BitNet instance:
- Streaming responses
- Conversation history with context window management
- System prompt customisation per conversation
- Copy / regenerate / edit messages
- Proxied through the Go backend (`BITNET_URL=http://127.0.0.1:8080`)
  so the BitNet port is never exposed to the internet

### Mind Maps — AI-Assisted Visual Mind Mapping
An interactive canvas for building mind maps:
- Create nodes, branches, and connections with mouse or keyboard
- Auto-layout (radial, tree, force-directed)
- "AI Expand" — select a node and ask BitNet to suggest child nodes
- Export to PNG or SVG
- Stored in VoidDB; shareable as read-only links

---

## Setup

### Prerequisites

| Tool | Version |
|------|---------|
| Docker Engine | 24+ |
| docker compose | v2 |
| nginx | 1.18+ |
| certbot | any recent |
| Go | 1.22+ (dev only) |
| Node.js | 20+ (dev only) |

The main lowkey stack must already be running so that VoidDB (`:7700`) and
BitNet (`:8080`) are available on the host.

### 1. Clone / enter the directory

```bash
cd /path/to/lowkey_web/site/bogdan
```

### 2. Create your env file

```bash
cp .env.example .env.bogdan
$EDITOR .env.bogdan
```

Fill in every value — pay special attention to:

| Variable | Notes |
|----------|-------|
| `VOIDDB_TOKEN` | Token from the running VoidDB instance |
| `JWT_SECRET` | Minimum 32 random characters |
| `TELEGRAM_BOT_TOKEN` | Create via [@BotFather](https://t.me/BotFather) |
| `BOGDAN_TELEGRAM_USER_IDS` | Your numeric Telegram user ID(s), comma-separated |

### 3. Deploy

```bash
sudo LETSENCRYPT_EMAIL=you@example.com ./deploy.sh
```

The script will:
1. Validate `.env.bogdan`
2. Install nginx and certbot if missing
3. Install an HTTP nginx config (for ACME challenge)
4. Obtain a Let's Encrypt certificate for `bogdan.lowkey.su`
5. Install the full HTTPS nginx config
6. Build and start the Docker containers
7. Wait for backend and frontend health checks to pass
8. Reload nginx

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VOIDDB_URL` | yes | — | VoidDB HTTP endpoint |
| `VOIDDB_TOKEN` | yes | — | VoidDB auth token |
| `JWT_SECRET` | yes | — | Secret for signing JWTs (≥ 32 chars) |
| `TELEGRAM_BOT_TOKEN` | yes | — | Bot token from @BotFather |
| `BOGDAN_TELEGRAM_USER_IDS` | yes | — | Comma-separated allowed Telegram user IDs |
| `MAIL_IMAP_HOST` | no | `mail.lowkey.su` | IMAP server hostname |
| `MAIL_IMAP_PORT` | no | `993` | IMAP port (TLS) |
| `MAIL_SMTP_HOST` | no | `mail.lowkey.su` | SMTP server hostname |
| `MAIL_SMTP_PORT` | no | `587` | SMTP port (STARTTLS) |
| `MAIL_DOMAIN` | no | `lowkey.su` | Default sending domain |
| `BITNET_URL` | no | `http://127.0.0.1:8080` | BitNet OpenAI-compatible endpoint |
| `UPLOAD_DIR` | no | `./uploads` | Host path for file storage |
| `PORT` | no | `8090` | Go backend listen port |

---

## Development Setup

### Backend (Go)

```bash
cd bogdan/backend
cp ../.env.example .env.bogdan
go mod download
go run .
# Server starts on :8090
```

Hot-reload with [air](https://github.com/air-verse/air):
```bash
go install github.com/air-verse/air@latest
air
```

### Frontend (Next.js)

```bash
cd bogdan/frontend
npm install        # or: bun install
cp ../.env.example .env.local
# Set NEXT_PUBLIC_API_URL=http://localhost:8090
npm run dev        # starts on :3210 (set PORT=3210 in .env.local)
```

---

## Production Deploy

```bash
# Full deploy from scratch
sudo LETSENCRYPT_EMAIL=admin@lowkey.su ./deploy.sh

# Re-deploy after code changes (certificate already exists)
sudo ./deploy.sh

# View logs
docker compose -p bogdan logs -f backend
docker compose -p bogdan logs -f frontend

# Restart a single service
docker compose -p bogdan restart backend

# Stop everything
docker compose -p bogdan down
```

---

## API Reference

All endpoints are prefixed with `/api/` in production (nginx strips the prefix
before forwarding to the Go backend on `:8090`).

### Auth

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/auth/request-otp` | Send OTP to Telegram. Body: `{ "telegram_id": 123456789 }` |
| `POST` | `/auth/verify-otp` | Verify OTP and receive JWT. Body: `{ "telegram_id": 123456789, "code": "123456" }` |
| `GET`  | `/auth/me` | Return authenticated user profile |
| `POST` | `/auth/logout` | Invalidate current session |

### Mail

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/mail/folders` | List IMAP folders |
| `GET`  | `/mail/messages?folder=INBOX&page=1` | Paginated message list |
| `GET`  | `/mail/messages/:id` | Fetch full message with body + attachments |
| `POST` | `/mail/send` | Send email via SMTP. Body: `{ to, subject, body, attachments[] }` |
| `PATCH`| `/mail/messages/:id` | Mark read/unread/flagged |
| `DELETE`| `/mail/messages/:id` | Move to Trash |

### Tasks

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/tasks/boards` | List all boards |
| `POST` | `/tasks/boards` | Create board |
| `GET`  | `/tasks/boards/:id` | Get board with columns and cards |
| `PATCH`| `/tasks/boards/:id` | Update board name |
| `DELETE`| `/tasks/boards/:id` | Delete board |
| `POST` | `/tasks/boards/:id/columns` | Add column |
| `PATCH`| `/tasks/columns/:id` | Update column |
| `DELETE`| `/tasks/columns/:id` | Delete column |
| `POST` | `/tasks/columns/:id/cards` | Create card |
| `PATCH`| `/tasks/cards/:id` | Update card (move, edit, reorder) |
| `DELETE`| `/tasks/cards/:id` | Delete card |

### Notes

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/notes` | List all notes (id, title, updatedAt) |
| `POST` | `/notes` | Create note. Body: `{ title, content }` |
| `GET`  | `/notes/:id` | Fetch note content |
| `PATCH`| `/notes/:id` | Update note |
| `DELETE`| `/notes/:id` | Delete note |
| `GET`  | `/notes/search?q=...` | Full-text search |
| `GET`  | `/notes/graph` | Return node/edge list for graph view |

### Files

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/files` | List files and folders at root or `?path=folder/sub` |
| `POST` | `/files/upload` | Upload file(s). Multipart form-data |
| `GET`  | `/files/download/:id` | Download file by ID |
| `GET`  | `/files/preview/:id` | Inline preview (images, PDF, text) |
| `POST` | `/files/folder` | Create folder. Body: `{ name, parent }` |
| `PATCH`| `/files/:id` | Rename or move |
| `DELETE`| `/files/:id` | Delete file or folder |
| `POST` | `/files/:id/share` | Create share link. Body: `{ expiresIn? }` |

### AI (BitNet proxy)

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/ai/models` | List available BitNet models |
| `POST` | `/ai/chat` | Non-streaming chat. Body: OpenAI-compatible `{ model, messages, ... }` |
| `POST` | `/ai/chat/stream` | Server-Sent Events streaming chat |
| `GET`  | `/ai/conversations` | List saved conversation IDs and titles |
| `POST` | `/ai/conversations` | Save a conversation |
| `DELETE`| `/ai/conversations/:id` | Delete conversation |

### Mind Maps

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/mindmaps` | List all mind maps |
| `POST` | `/mindmaps` | Create mind map. Body: `{ title }` |
| `GET`  | `/mindmaps/:id` | Fetch mind map data (nodes + edges) |
| `PATCH`| `/mindmaps/:id` | Save mind map state |
| `DELETE`| `/mindmaps/:id` | Delete mind map |
| `POST` | `/mindmaps/:id/expand` | AI-expand a node. Body: `{ nodeId, prompt? }` |
| `POST` | `/mindmaps/:id/share` | Create read-only share link |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| State management | Zustand |
| Backend | Go 1.22, net/http (stdlib router) |
| Database | VoidDB (shared instance, port 7700) via `@voiddb/orm` / Go HTTP client |
| Auth | Telegram Bot API + TOTP OTP + JWT (HS256) |
| Mail | Go `imap` + `smtp` (standard library + go-imap) |
| AI | BitNet (shared instance, port 8080) — OpenAI-compatible REST |
| File storage | Local filesystem, served by Go backend |
| Containerisation | Docker + docker compose v2 |
| Reverse proxy | nginx with Let's Encrypt TLS |
| CI/CD | `deploy.sh` — single-command deploy |
