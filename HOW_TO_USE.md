# Application Usage and Explanation Guide

Welcome to the **Agent Orchestration** application! This guide explains what this project is, how it works behind the scenes, and provides step-by-step instructions on how to use it.

## 1. What is this Project?

This project is an **AI Agent Orchestration System**. Instead of manually giving instructions to an AI every single time, you create a **Task** (e.g., "Add a login button") and the application automatically guides AI agents through a **Pipeline** of stages:

1. **Planning:** An AI plans how to implement the feature
2. **Coding:** An AI writes the code based on the plan
3. **Reviewing:** An AI reviews the code for correctness

The system automatically selects the optimal AI agent for each stage based on task complexity; no manual agent selection required.

### The Four Main Components

1. **The Frontend (UI):** The visual website you interact with to create and monitor tasks (React/Vite, port 5173)
2. **The Backend Server (API):** Saves tasks to a local SQLite database (Express, port 5174)
3. **The Background Worker:** Watches the database for new tasks, claims them, runs AI agents through the pipeline, and streams live logs
4. **The Flask Socket.IO Server:** Receives agent log events from the worker and broadcasts them to connected browsers in real-time (port 5002)

### How Agents Work

The system supports three agents with automatic fallback:

| Agent | Best For | Requires |
|-------|----------|----------|
| **Devin** | Complex coding, multi-file changes | Devin CLI installed, paid plan |
| **DeepSeek** | Planning, review, low/medium coding | `DEEPSEEK_API_KEY` with credits |
| **Gemini** | All stages | `GEMINI_API_KEY` from AI Studio, or OAuth login |

**Fallback chain:** `devin → deepseek → gemini`. If the selected agent fails, the system automatically tries the next one.

**Auto-selection logic:**
- Planning / Reviewing → DeepSeek
- High complexity coding → Devin
- Low / medium complexity coding → DeepSeek

---

## 2. Step-by-Step: How to Start the Application

You must start all four components in separate terminal windows.

### Step 1: Install requirements

```bash
npm install
pip install -r server-flask/requirements.txt
```

### Step 2: Terminal 1 — Flask Socket.IO Server (port 5002)

```bash
# Activate the Python virtual environment first (macOS/Linux)
source server-flask/.venv/bin/activate

cd server-flask
python app.py
```

You'll see `Listening on http://0.0.0.0:5002` when it's ready.

### Step 3: Terminal 2 — Frontend UI (port 5173)

```bash
npm run dev
```

Open your browser at `http://localhost:5173`.

### Step 4: Terminal 3 — Backend API (port 5174)

```bash
npm run server
```

### Step 5: Terminal 4 — Background Worker

```bash
npm run worker
```

The worker will immediately start watching for queued tasks.

---

## 3. Environment Setup (.env.agent_orchestration)

Create a `.env.agent_orchestration` file in the project root with your credentials. The worker loads this automatically on startup.

```bash
# Jira Integration
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_USER=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token
JIRA_SPACE_KEYS=KAN
JIRA_REPO_MAPPING={"KAN":"https://github.com/owner/repo.git"}

# Bitbucket Integration
BITBUCKET_USERNAME=your-username
BITBUCKET_HTTPS_TOKEN=your-https-token
BITBUCKET_TOKEN=your-access-token
BITBUCKET_APP_PASSWORD=your-app-password

# GitHub Integration
GITHUB_TOKEN=ghp_your-personal-access-token

# Devin Agent
DEVIN_PATH=/path/to/devin          # find with: which devin
DEVIN_PERMISSION_MODE=dangerous
DEVIN_MODEL=swe-1.6                # do not leave this blank if set

# DeepSeek Agent
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_MODEL=deepseek-coder

# Gemini Agent
GEMINI_API_KEY=AIzaSy...           # from https://aistudio.google.com/apikey
GEMINI_MODEL=gemini-2.0-flash
GEMINI_TIMEOUT_MS=300000           # 5 minutes (handles rate limit retries)

# Flask Socket.IO URL (only change if you moved the Flask server)
FLASK_SOCKET_URL=http://localhost:5002
```

### Finding agent paths

```bash
which devin    # Devin CLI path
which gemini   # Gemini CLI path
```

### Important notes

- **`DEVIN_MODEL`** — if set, must be a valid model name (e.g. `swe-1.6`). A blank `DEVIN_MODEL=` overrides the value set earlier and causes "Unknown model" errors. Either set it to a valid value or remove the line entirely.
- **`GOOGLE_API_KEY`** — if this is set in your shell environment, the Gemini CLI will use it instead of `GEMINI_API_KEY`. Set `GOOGLE_API_KEY=` (blank) in your env file to override it.
- **`GEMINI_TIMEOUT_MS`** — the Gemini CLI retries on rate limits. Setting this to 300000 (5 min) prevents premature timeouts during retries.

---

## 4. Gemini CLI Authentication

The Gemini agent runs the `gemini` CLI binary. Two authentication methods are supported:

### Option 1: API Key (recommended)
1. Go to **https://aistudio.google.com/apikey** and create a free key
2. Set `GEMINI_API_KEY=AIzaSy...` in `.env.agent_orchestration`
3. The free tier gives 15 RPM and 1500 requests/day on Gemini 2.0 Flash

### Option 2: OAuth login
```bash
gemini auth login   # opens browser, authenticate with your Google account
```
Leave `GEMINI_API_KEY` unset — the CLI uses its stored OAuth token (`~/.gemini/settings.json`).

**Note:** The "Gemini Code Assist for individuals" OAuth tier has been discontinued. If you get an `IneligibleTierError`, use an API key instead.

---

## 5. Step-by-Step: How to Use the UI

### Creating a Task

1. Click **Create Task** in the left sidebar
2. Fill in:
   - **Title** — what to build (e.g., "Add dark mode toggle")
   - **Description** — optional detail about requirements
   - **Pipeline** — `plan-code-review` (default) or `code-only`
   - **Repository URL** — Git URL for the repo to work on (optional for simple tasks)
   - **Jira Ticket** — link to a Jira issue (optional)
3. Click **Create & Queue**

### Watching a Task Run

1. Go to the **Dashboard** — your task appears with status `queued`
2. The worker picks it up and status changes to `running`
3. Click the task to open **Task Details** — you'll see:
   - Pipeline progress (planning → coding → reviewing)
   - Live agent logs streaming in real-time
   - PR tracking once a pull request is created

### Task Results

When the task completes, check `server/workspaces/{task-id}/` on your filesystem:
- `repo/` — the cloned repository with the agent's code changes
- `planning/`, `coding/`, `reviewing/` — stage workspaces with `prompt.txt` and agent output

---

## 6. Jira Integration

### Fetching Jira Issues

The Dashboard shows open Jira issues from your configured projects. Issue descriptions are automatically extracted from Atlassian Document Format (ADF).

Click **Send to agent** on any issue to queue it as a task. The description, priority, and ticket key are passed through automatically.

### Setup

```bash
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_USER=your-email@example.com
JIRA_API_TOKEN=your-api-token
JIRA_SPACE_KEYS=KAN,PROJ           # comma-separated project keys to fetch
JIRA_REPO_MAPPING={"KAN":"https://github.com/owner/repo.git"}
```

### Creating Tasks via API

```bash
curl -X POST http://localhost:5174/api/tasks/from-jira \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "Fix login bug",
    "description": "Users cannot login with SSO",
    "key": "PROJ-123",
    "priority": "high",
    "repository": "https://github.com/owner/repo.git"
  }'
```

Jira ticket keys are automatically included in commit messages and PR titles (e.g. `PROJ-123 Fix login bug`).

---

## 7. Git Integration and Pull Requests

When a repository URL is provided, agents:
1. Clone the repository into a temporary workspace
2. Edit actual source files
3. Commit changes to a new branch
4. Push and create a real Pull Request

### Supported Formats

- GitHub: `https://github.com/owner/repo.git`
- Bitbucket: `https://bitbucket.org/workspace/repo.git` or `https://username@bitbucket.org/workspace/repo.git`

### Bitbucket Auth (tried in order)
1. `BITBUCKET_HTTPS_TOKEN`
2. `BITBUCKET_TOKEN`
3. `BITBUCKET_APP_PASSWORD` + `BITBUCKET_USERNAME`

### GitHub Auth
Set `GITHUB_TOKEN` with a Personal Access Token that has `repo` scope.

---

## 8. Live Log Streaming Architecture

```
Worker (Node.js)
  ↓ emits "agent-log" events via Socket.IO
Flask Socket.IO Server (port 5002)
  ↓ broadcasts to taskId room
Browser (Task Details page)
  ↓ displays in terminal
```

**If you don't see logs:**
- Ensure the Flask server is running on port 5002
- Open the Task Details page **before** the worker starts processing — logs are not replayed after the fact
- Check your browser console for Socket.IO connection errors

---

## 9. Troubleshooting

| Problem | Fix |
|---------|-----|
| Worker not claiming tasks | Ensure all 4 processes are running |
| `Unknown model: ''` on Devin | Remove blank `DEVIN_MODEL=` line or set it to a valid model |
| Gemini `IneligibleTierError` | Use an API key from https://aistudio.google.com/apikey instead of OAuth |
| Gemini rate limit / timeout | Set `GEMINI_TIMEOUT_MS=300000` and use `gemini-2.0-flash` model |
| DeepSeek HTTP 402 | Add credits at https://platform.deepseek.com |
| Jira shows "(No description provided)" | Verify the Jira ticket has a description; check `JIRA_API_TOKEN` is valid |
| No logs in browser terminal | Open Task Details before worker starts; check Flask is running |
| Bitbucket PR creation fails | Try all three token types; check repo URL format |

---

## 10. Cleaning Up

Temporary workspace folders accumulate in `server/workspaces/`. Delete them when no longer needed:

```bash
rm -rf server/workspaces/*
```

---

## Summary

> This is an orchestration dashboard for AI coding agents. Define a coding task in the web UI, the backend queues it, and a background worker picks it up and runs AI agents (Devin, DeepSeek, Gemini) through a configurable pipeline — streaming live logs back to your browser in real-time. Agents can clone real repositories, write code, commit changes, and open pull requests automatically.

Step-by-step: run everything again (after the Flask Socket fix)
0) Stop old processes
Close/stop these terminals if they’re still running:

source /Users/jingyin/Downloads/agent_orchestration/server-flask/.venv/bin/activate
Flask Socket.IO (python app.py in server-flask/)
Frontend (npm run dev)
Backend (npm run server)
Worker (npm run worker)11111111111111111111111111111111111/
1) Terminal 1 — Flask Socket.IO (PORT 5002)

cd "c:/Users/Gary Chong/Downloads/Telegram Desktop/agent_orchestration/agent_orchestration/server-flask"
python app.py
2) Terminal 2 — Frontend UI (PORT 5173)

cd "c:/Users/Gary Chong/Downloads/Telegram Desktop/agent_orchestration/agent_orchestration"
npm run dev
Open browser to: http://localhost:5173

3) Terminal 3 — Backend API (PORT 5174)

cd "c:/Users/Gary Chong/Downloads/Telegram Desktop/agent_orchestration/agent_orchestration"
npm run server
4) Terminal 4 — Worker

cd "c:/Users/Gary Chong/Downloads/Telegram Desktop/agent_orchestration/agent_orchestration"
npm run worker