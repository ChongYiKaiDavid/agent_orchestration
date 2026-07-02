# AI Agent Orchestration System

A full-stack AI agent orchestration system that manages and executes coding tasks using multiple AI agents through configurable pipelines. The system includes a React TypeScript frontend dashboard, Node.js backend API, background worker, and Flask Socket.IO server for real-time log streaming.

## Architecture

The system consists of four main components:

1. **Frontend (React/TypeScript)** - Modern dark-themed dashboard for creating and monitoring tasks
2. **Backend API (Node.js/Express)** - REST API for task management with SQLite database
3. **Background Worker (Node.js)** - Processes queued tasks, runs AI agents through pipelines
4. **Flask Socket.IO Server (Python)** - Real-time event streaming for live agent logs and PTY sessions

## Features

- 🤖 **Multi-Agent Support** - Devin, DeepSeek, and Gemini AI agents with automatic fallback
- 🎯 **Auto-Selection** - Automatically selects optimal agent per stage based on task complexity
- 📋 **Configurable Pipelines** - Define custom workflows (plan → code → review, code-only)
- 🔗 **Git Integration** - Clone repositories, make real code changes, create PRs on GitHub/Bitbucket
- 🎫 **Jira Integration** - Fetch Jira issues with full description extraction, auto-queue tasks
- 📡 **Real-time Logs** - Live terminal streaming via Socket.IO and native terminal window spawning
- 🔔 **Real-time Notifications** - WebSocket-based notifications for task lifecycle events (session-based)
- 📊 **Pipeline Visualizer** - Visual representation of pipeline stages with real-time status updates
- 🔀 **PR Tracking** - Monitor pull request status with automatic polling and status updates
- 🧪 **Automated Test Execution** - Detect test frameworks and run tests with result visualization
- 🌙 **Dark Themed UI** - Modern React dashboard with responsive design

## Project Structure

```
agent_orchestration/
├── src/                          # Frontend React/TypeScript
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── Layout.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── sections/
│   │   │   ├── Notifications.tsx
│   │   │   ├── PipelineVisualizer.tsx
│   │   │   ├── PRTracking.tsx
│   │   │   └── TestResults.tsx
│   │   └── terminal/
│   │       └── Terminal.tsx
│   ├── pages/
│   │   ├── Activity.tsx
│   │   ├── Agents.tsx
│   │   ├── CreateTask.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Decompose.tsx
│   │   ├── Pipelines.tsx
│   │   ├── Settings.tsx
│   │   └── TaskDetails.tsx
│   ├── __tests__/
│   ├── App.tsx
│   └── main.tsx
├── server/                       # Backend Node.js
│   ├── agents/                   # AI agent implementations
│   │   ├── devin.js
│   │   ├── devin.json
│   │   ├── deepseek.js
│   │   ├── deepseek.json
│   │   ├── gemini.js
│   │   └── gemini.json
│   ├── pipelines/                # Pipeline YAML configs
│   │   ├── code-only.yaml
│   │   └── plan-code-review.yaml
│   ├── skills/                   # Agent skill configurations
│   │   ├── planner.json
│   │   ├── coder.json
│   │   └── reviewer.json
│   ├── workspaces/               # Temporary task workspaces
│   ├── engine.js                 # Core task processing logic
│   ├── auto-selector.js          # Agent and pipeline auto-selection
│   ├── index.js                  # Express API server
│   ├── worker.js                 # Background worker
│   ├── db.js                     # SQLite database
│   ├── routes.js                 # API routes
│   ├── pipeline-loader.js        # YAML pipeline loader
│   ├── pipeline-edit-store.js    # Pipeline edit persistence
│   ├── cli_runner.js             # Generic CLI runner
│   ├── pr-poller.js              # PR status polling service
│   └── orphan-recovery.js        # Orphaned task recovery
├── server-flask/                 # Flask Socket.IO server
│   ├── app.py                    # Flask application
│   └── requirements.txt          # Python dependencies
├── db.sqlite                     # SQLite database file
└── package.json                  # Node.js dependencies
```

## Installation

### Prerequisites
- Node.js (v18 or higher)
- Python (v3.8 or higher)
- npm or yarn

### Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies for Flask Socket.IO server
pip install -r server-flask/requirements.txt
```

## Quick Start

The system requires four separate processes to run simultaneously. Open four terminal windows:

### Terminal 1: Flask Socket.IO Server (Port 5002)
```bash
cd server-flask
python app.py
```

### Terminal 2: Frontend UI (Port 5173)
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

### Terminal 3: Backend API (Port 5174)
```bash
npm run server
```

### Terminal 4: Background Worker
```bash
npm run worker
```

## Environment Variables

Create a `.env.agent_orchestration` file in the root directory:

```bash
# Jira Integration
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_USER=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token
JIRA_SPACE_KEYS=KAN
JIRA_REPO_MAPPING={"KAN":"https://github.com/owner/repo.git"}

# Bitbucket Integration
BITBUCKET_USERNAME=your-username
BITBUCKET_APP_PASSWORD=your-app-password
BITBUCKET_TOKEN=your-access-token
BITBUCKET_HTTPS_TOKEN=your-https-token

# GitHub Integration
GITHUB_TOKEN=ghp_your-personal-access-token

# Devin Agent
DEVIN_PATH=/path/to/devin
DEVIN_PERMISSION_MODE=dangerous
DEVIN_MODEL=swe-1.6

# DeepSeek Agent
DEEPSEEK_API_KEY=your-deepseek-api-key
DEEPSEEK_MODEL=deepseek-coder

# Gemini Agent (CLI-based, one of the following auth methods required)
GEMINI_API_KEY=AIzaSy...          # From https://aistudio.google.com/apikey
GEMINI_MODEL=gemini-2.0-flash     # Model to use
GEMINI_TIMEOUT_MS=300000          # Timeout in ms (default: 5 minutes)
# OR authenticate via OAuth: run `gemini auth login` in your terminal

# Flask Socket.IO URL (if different from default)
FLASK_SOCKET_URL=http://localhost:5002
```

### Agent Auto-Selection

The system automatically selects the optimal agent for each pipeline stage based on:
- **Task complexity** (high, medium, low) derived from title and description keywords
- **Stage type** (planning, coding, reviewing)

**Selection Logic:**
- **Planning / Reviewing**: DeepSeek (fast, good at analysis)
- **High complexity coding**: Devin
- **Low / medium complexity coding**: DeepSeek

**Fallback chain:** If the selected agent fails, the system automatically tries the next agent in order: `devin → deepseek → gemini`. All agents are tried before a stage is marked as failed.

You don't need to specify agents in pipeline configurations — the system handles selection and fallback automatically.

## Gemini CLI Setup

The Gemini agent runs the `gemini` CLI binary in headless mode. Two authentication methods are supported:

### Option 1: API Key (recommended)
1. Go to https://aistudio.google.com/apikey and create a free key
2. Set `GEMINI_API_KEY=AIzaSy...` in `.env.agent_orchestration`

### Option 2: OAuth login
```bash
gemini auth login   # opens browser to authenticate with your Google account
```
Leave `GEMINI_API_KEY` unset — the CLI will use its stored OAuth token.

**Note:** The free tier on AI Studio (API key) provides 15 RPM and 1500 req/day on Gemini 2.0 Flash. If you hit rate limits, set `GEMINI_TIMEOUT_MS=300000` (5 min) so the worker waits out retries instead of failing immediately.

## Available Scripts

### Frontend
- `npm run dev` - Start Vite development server (port 5173)
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally
- `npm test` - Run frontend unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

### Backend
- `npm run server` - Start Express API server (port 5174)
- `npm run worker` - Start background worker
- `npm run cli` - Run CLI tool for task management

## Database Schema

The system uses SQLite with the following main tables:

- **tasks** - Task definitions with title, description, repository, pipeline, jira_ticket
- **executions** - Task execution records
- **stage_executions** - Individual pipeline stage executions
- **artifacts** - Generated artifacts from stages
- **pull_requests** - Created PR records
- **activity_log** - System activity tracking
- **notifications** - Real-time notifications for task lifecycle events

## Git Integration

The system can clone repositories, make real code changes, and create pull requests:

### Supported Repository Formats
- GitHub: `https://github.com/owner/repo.git` or `git@github.com:owner/repo.git`
- Bitbucket: `https://bitbucket.org/workspace/repo.git`, `git@bitbucket.org:workspace/repo.git`, or `https://username@bitbucket.org/workspace/repo.git`

### Commit Message Format
When a Jira ticket is linked, commit messages follow the format: `{jira_ticket} {title}`
Example: `JIRA-123 Add a greeting function to README`

### Authentication
The system tries multiple authentication methods in order for Bitbucket:
1. BITBUCKET_HTTPS_TOKEN
2. BITBUCKET_TOKEN
3. BITBUCKET_APP_PASSWORD (with username)

## Jira Integration

### Fetching Issues
The dashboard fetches open Jira issues and displays them in a panel. Issues include full descriptions extracted from Atlassian Document Format (ADF). Click **Send to agent** to queue a task directly from a Jira issue — the description, priority, and ticket key are all passed through automatically.

Only issues from projects listed in `JIRA_SPACE_KEYS` are fetched. Use `JIRA_REPO_MAPPING` to automatically assign a repository to tasks based on the Jira project key:

```json
{"KAN": "https://github.com/owner/repo.git"}
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

The Jira ticket number is automatically included in commit messages and PR titles.

## Features

### Real-time Notifications
The system provides WebSocket-based notifications for task lifecycle events:
- Task created, started, completed, failed
- Pull request created
- Notifications are displayed in the sidebar with unread count
- Mark notifications as read individually or all at once
- Notifications are session-based (not persisted across browser refreshes)

### Terminal Window Spawning
The worker spawns native terminal windows for real-time log viewing:
- Automatically opens a new terminal window when a task starts processing
- Uses platform-specific terminal emulators (Terminal.app on macOS, cmd on Windows, gnome-terminal on Linux)
- Tails the worker log file in real-time for each task

### Pipeline Visualizer
Visual representation of pipeline execution with real-time status updates:
- Shows pipeline stages (planning → coding → reviewing)
- Real-time status indicators (pending, running, completed, failed)
- Stage details with timestamps
- Automatic updates via Socket.IO

### PR Tracking
Monitor pull request status with automatic polling:
- View all PRs or PRs for a specific task
- Status indicators (open, merged, closed, approved, changes_requested)
- Automatic polling every 5 minutes
- Direct links to GitHub/Bitbucket

### Automated Test Execution
Detect and run tests in the repository:
- Automatic test framework detection (Jest, Vitest, Mocha, Pytest, unittest)
- One-click test execution from Task Details
- Test results visualization with pass/fail counts
- Full test output display

### Task Details Page
- Full task information including description, pipeline, repository, and Jira ticket
- Pipeline progress with stage-by-stage status
- PR tracking panel
- Resolved pipeline name shown (never shows raw "auto")

## Development Stack

### Frontend
- **React 18** with TypeScript for component development
- **Vite** for fast development and optimized builds
- **Custom CSS** for styling (no Tailwind dependency)
- **Lucide React** for icon components

### Backend
- **Node.js** with Express for REST API
- **SQLite** for database
- **Python Flask** with Socket.IO for real-time streaming
- **AI Agents** - Devin, DeepSeek API, Gemini CLI

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Troubleshooting

### Worker not claiming tasks
- Ensure the worker process is running (`npm run worker`)
- Check that the backend server is running (`npm run server`)
- Verify the database has queued tasks

### Agent fails with "Unknown model"
- Ensure `DEVIN_MODEL` is set to a valid model (e.g. `swe-1.6`) or left completely unset
- Do not set `DEVIN_MODEL=` (blank value overrides a valid value set earlier in the file)

### Gemini agent fails with authentication error
- Run `gemini auth login` to re-authenticate via OAuth, or set `GEMINI_API_KEY` with a valid AI Studio key
- Ensure `GOOGLE_API_KEY` is not set to a different (rate-limited) key — it takes precedence over `GEMINI_API_KEY` in the CLI

### Gemini agent times out
- The free tier has low RPM quotas; the agent will retry for up to `GEMINI_TIMEOUT_MS` ms (default 5 min)
- Switch to `GEMINI_MODEL=gemini-2.0-flash` for higher free-tier quota
- Consider upgrading to a paid API key for higher limits

### DeepSeek fails with HTTP 402
- Add credits to your DeepSeek account at https://platform.deepseek.com

### Terminal window not opening
- On macOS: Ensure Terminal.app is allowed to run scripts
- On Linux: Ensure gnome-terminal or xterm is installed
- On Windows: Ensure cmd.exe can spawn new windows

### No logs in browser terminal
- Ensure Flask Socket.IO server is running on port 5002
- Open the Task Details page before the worker starts processing
- Check browser console for Socket.IO connection errors

### Jira description shows "(No description provided)"
- Verify the Jira ticket has a description in Jira itself
- Confirm `JIRA_API_TOKEN` is valid and has read access to the project
- The system extracts descriptions from Atlassian Document Format (ADF) automatically

### Bitbucket PR creation fails
- Verify authentication tokens are set correctly
- Try different token types (BITBUCKET_HTTPS_TOKEN, BITBUCKET_TOKEN, BITBUCKET_APP_PASSWORD)
- Check repository URL format supports embedded usernames

## License

MIT
