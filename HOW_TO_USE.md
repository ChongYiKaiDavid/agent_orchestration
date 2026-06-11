# Application Usage and Explanation Guide

Welcome to the **Agent Orchestration** application! This guide will explain exactly what this project is, how it works behind the scenes, and provide step-by-step instructions on how to use it.

## 1. What is this Project?

This project is an **AI Agent Orchestration System**. Imagine you are a manager, and you have AI "workers" (agents) that can plan code, write code, and review code.

Instead of manually giving instructions to an AI every single time, this application allows you to create a **Task** (e.g., "Add a new login button"). The application then automatically guides your AI agents through a **Pipeline** of stages, such as:
1. **Planning:** An AI plans out how to implement the feature.
2. **Coding:** An AI writes the code based on the plan.
3. **Reviewing:** An AI reviews the code to ensure it's safe and correct.

### The Four Main Components

To make this magic happen, the application is split into four separate parts that must run at the same time:

1. **The Frontend (UI):** The visual website you interact with to create and monitor tasks (built with React/Vite).
2. **The Backend Server (API):** A server that takes your tasks from the UI and saves them into a local database (SQLite).
3. **The Background Worker:** An automated system that constantly checks the database for new tasks. When it finds one, it claims it, prepares an isolated workspace folder, and runs the AI agent through the pipeline stages. It streams live logs to the Flask Socket.IO server.
4. **The Flask Socket.IO Server:** A real-time event server that receives agent log events from the worker and broadcasts them to connected browser clients. It also provides interactive PTY (terminal) sessions.

---
cd "C:\Users\Gary Chong\Downloads\Telegram Desktop\agent_orchestration\agent_orchestration"
## 2. Step-by-Step: How to Start the Application

Because this project relies on four distinct pieces working together, you must start all of them in separate terminal windows.

### Step 1: Install the requirements

Open your terminal in the `agent_orchestration` folder and install all necessary packages:

```bash
npm install
pip install -r server-flask/requirements.txt
```

### Step 2: Start the Flask Socket.IO Server (Terminal 1)

Open a **new terminal window** in the `agent_orchestration` folder and run:

```bash
cd server-flask
python app.py
```

* **What this does:** Starts the Flask Socket.IO server on port `5002`. This handles real-time event streaming — both agent log broadcasts to the browser terminal AND interactive PTY terminal sessions.
* **What to run (Terminal 1):**

  ```bash
  cd server-flask
  # Default (most common): Flask-SocketIO listens on port 5002
  python app.py
  ```

* **How to know which Socket.IO port you are running on**
  - Check `server-flask/app.py`: at the bottom it calls `socketio.run(... port=5002)`.
  - If you changed that `port=...` value, then your new port is the one you must use.

* **If you changed the Flask port and want Node to use it**
  - set `FLASK_SOCKET_URL` to match the URL/port you configured in `app.py`.


* **What to watch for:** When a browser connects, you'll see debug output like `[DEBUG] join-task: socket ... joined room ...`. When the worker emits logs, you'll see `[DEBUG] agent-log -> room ...`.

* **If your setup uses a different Flask Socket.IO URL:**
  - Start backend/worker with `FLASK_SOCKET_URL`.
  - Start frontend dev server with `VITE_FLASK_SOCKET_URL`.


### Step 3: Start the Frontend UI (Terminal 2)

In the same terminal window (or a new one), run:

```bash
npm run dev
```

* **What this does:** It starts the visual dashboard. You can now open your web browser and go to `http://localhost:5173` to see the application.
* **Note:** The Vite dev server proxies API requests (`/api` → `localhost:5174`) but does **not** proxy Socket.IO WebSocket connections. The frontend connects directly to the Flask Socket.IO server at `localhost:5002`.

### Step 4: Start the Backend Server (Terminal 3)

Open a **new terminal window** in the `agent_orchestration` folder and run:

```bash
npm run server
```

* **What this does:** It starts the background API server. Without this, your frontend cannot save tasks to the database.

### Step 5: Start the Background Worker (Terminal 4)

Open a **new terminal window** in the `agent_orchestration` folder and run:

```bash
npm run worker
```

* **What this does:** It starts the background worker. It will immediately begin looking for queued tasks in the database and executing them. As it runs, it streams real-time agent logs (planning output, coding output, stage completion) to the Flask Socket.IO server via Socket.IO events.

---

## 3. Step-by-Step: How to Use the UI

Now that everything is running, open your web browser and navigate to `http://localhost:5173`.

### Step 1: Create a Task

1. Look at the left sidebar menu and click on **Create Task**.
2. **Title:** Give your task a name (e.g., "Update Homepage UI").
3. **Description:** Briefly describe what needs to be done.
4. **Pipeline:** You can choose the workflow you want the AI to follow.
5. **Repository URL (Optional):** If you want the AI to work on real code, paste a public Git URL here. If you just want to test the system, **leave this blank**.
6. **Submit:** Click the "Create & Queue" button.

* **What happens behind the scenes:** The UI sends your task to the Backend Server, which saves it in the database with status `"queued"`.

### Step 2: Watch the Magic Happen

1. Go to the **Dashboard** or **Recent Tasks** page.
2. You will see your task. Its status will change from `queued` → `running`.
3. **Click on the task** to open the **Task Details** page. This page contains a **live terminal** that streams the agent's real-time output directly in your browser as the worker processes the task.

### Step 3: Understand the Results

Once the task finishes, its status will change to `completed`.

But where did the AI do its work?

1. Open your computer's file explorer.
2. Navigate to `agent_orchestration/server/workspaces/`.
3. You will see a folder with a unique ID matching your task.
4. Inside that folder, you will see sub-folders for each pipeline stage (e.g., `planning`, `coding`, `reviewing`).
5. Inside those folders, you will find a `prompt.txt` (the instructions given to the AI) and an `output.txt` (the simulated answer from the AI).

---

## 4. Live Log Streaming Architecture

The system uses a Socket.IO-based real-time streaming pipeline:

```
Worker (Node.js)
  ↓ emits "agent-log" events
Flask Socket.IO Server (port 5002)
  ↓ broadcasts to taskId room
Browser (Task Details page)
  ↓ displays in xterm.js terminal
```

**How it works:**

1. When you open the Task Details page, the browser terminal component sends a `join-task` event to Flask, joining the room that matches your task ID.
2. The Flask server puts that browser socket into the `taskId` room.
3. When the worker emits an `agent-log` event, Flask broadcasts it to the `taskId` room — only your browser receives it.
4. The browser terminal displays the ANSI-colored log output in real-time.

**If you don't see logs:** Make sure the Flask Socket.IO server is running (`python3 app.py` in `server-flask/`). The browser terminal must be opened **before** the worker starts processing the task, so it can join the task room. If logs were emitted before you opened the page, they are not replayed — restart the worker and create a new task.

---

## 5. Interactive PTY Terminal

Each browser connection to the Flask Socket.IO server automatically gets its own PTY (pseudo-terminal) shell session. When you switch the Task Details terminal to **PTY mode**, you can type commands directly into that shell and see the output streamed back character-by-character.

This is separate from the agent log stream — the PTY gives you a direct interactive shell inside the Flask server process.

---

## 6. Real Pull Request Creation (GitHub & Bitbucket)

The worker can automatically push branches and open real Pull Requests on GitHub or Bitbucket if you provide the appropriate credentials.

### Storing Credentials Permanently (Recommended)
Instead of typing your tokens every time, you can save them in a `.env` file so the worker automatically loads them:
1. Copy the `.env.example` file and rename the copy to `.env`.
2. Open the `.env` file and uncomment (remove the `#`) from the token you want to use.
3. Paste your actual token/password next to the `=` sign.
4. Now, you can simply run `npm run worker` and it will automatically use your saved credentials.

---

### Passing Credentials via Terminal (Temporary)
If you prefer not to use a `.env` file, you can pass them when starting the worker:

#### For GitHub
You need a GitHub Personal Access Token (PAT) with `repo` scopes.

```bash
# On Windows PowerShell:
$env:GITHUB_TOKEN="ghp_your_token_here"
npm run worker

# On Mac/Linux:
GITHUB_TOKEN="ghp_your_token_here" npm run worker
```

#### For Bitbucket
You can use either a **Workspace/Repository Access Token** (Bearer) OR an **App Password** (Basic Auth).

**Option A: Using App Password (Recommended for user accounts)**
Generate an App Password in your Bitbucket settings with `repository:write` and `pullrequest:write` permissions.

```bash
# On Windows PowerShell:
$env:BITBUCKET_USERNAME="your_bitbucket_username"
$env:BITBUCKET_APP_PASSWORD="your_app_password"
npm run worker

# On Mac/Linux:
BITBUCKET_USERNAME="your_username" BITBUCKET_APP_PASSWORD="your_app_password" npm run worker
```

**Option B: Using Repository/Workspace Token**
```bash
# On Windows PowerShell:
$env:BITBUCKET_TOKEN="your_access_token"
npm run worker
```

#### For GitHub
```bash
# Set token in .env or via terminal
GITHUB_TOKEN="ghp_your_personal_access_token" npm run worker

# Token needs 'repo' scope for push/PR access
```

---

## 7. Environment Setup (.env.agent_orchestration)

Instead of passing credentials via terminal each time, use the `.env.agent_orchestration` file:

```bash
# Copy the example file
cp .env.example .env.agent_orchestration

# Edit this file with your credentials
```

**Available variables:**

| Variable | Description |
|----------|-------------|
| `JIRA_BASE_URL` | Your Jira instance URL |
| `JIRA_USER` | Jira email |
| `JIRA_API_TOKEN` | Jira API token |
| `BITBUCKET_USERNAME` | Bitbucket username |
| `BITBUCKET_APP_PASSWORD` | Bitbucket app password |
| `BITBUCKET_HTTPS_TOKEN` | Bitbucket access token for HTTPS |
| `GITHUB_TOKEN` | GitHub Personal Access Token |
| `GEMINI_API_KEY` | Google Gemini API key |
| `GEMINI_MODEL` | Gemini model (default: gemini-2.0-flash) |
| `FLASK_SOCKET_URL` | Flask Socket.IO URL |

The worker automatically loads these when started.

---

## 8. Agents Edit Real Files

When you provide a **Repository URL**, the AI agents now:
1. Clone the repository into a temporary workspace
2. **Edit actual source files** in the working tree (not just output files)
3. Commit changes to a new branch
4. Push and create a real Pull Request

This means the agent's changes are **real** - they're in your repository, not just in logs.

---

## 9. Jira Integration

The system can also integrate with Jira to link tasks to Jira tickets:

1. Create a task in the UI
2. Enter a Jira ticket ID (e.g., `PROJ-123`) in the Task Details
3. The system will fetch the ticket and link it to your task
4. Results can be posted back to the Jira ticket as comments

Set up via `.env.agent_orchestration`:
- `JIRA_BASE_URL` - Your Jira instance URL
- `JIRA_USER` - Your Jira email
- `JIRA_API_TOKEN` - Your Jira API token

---

## 10. Cleaning Up Workspaces

After tasks complete, temporary workspace folders accumulate in `server/workspaces/`. You can safely delete these:

```bash
rm -rf server/workspaces/*
```

The duplicate `server/server/` folder (if it exists) can also be deleted.

---

## Summary

> "This is an orchestration dashboard for AI coding agents. I can go to the web interface and define a coding task. A backend server receives that task and puts it in a queue. A separate background worker watches that queue, picks up the task, and streams live agent logs back to my browser via a real-time Socket.IO pipeline — so I can watch the AI think, code, and review in real-time inside the browser terminal."

Step-by-step: run everything again (after the Flask Socket fix)
0) Stop old processes
Close/stop these terminals if they’re still running:

Flask Socket.IO (python app.py in server-flask/)
Frontend (npm run dev)
Backend (npm run server)
Worker (npm run worker)
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