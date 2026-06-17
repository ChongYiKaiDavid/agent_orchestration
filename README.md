# AI Agent Orchestration System

A full-stack AI agent orchestration system that manages and executes coding tasks using multiple AI agents through configurable pipelines. The system includes a React TypeScript frontend dashboard, Node.js backend API, background worker, and Flask Socket.IO server for real-time log streaming.

## Architecture

The system consists of four main components:

1. **Frontend (React/TypeScript)** - Modern dark-themed dashboard for creating and monitoring tasks
2. **Backend API (Node.js/Express)** - REST API for task management with SQLite database
3. **Background Worker (Node.js)** - Processes queued tasks, runs AI agents through pipelines
4. **Flask Socket.IO Server (Python)** - Real-time event streaming for live agent logs and PTY sessions

## Features

- 🤖 **Multi-Agent Support** - Gemini, Ollama, and other AI agents
- 📋 **Configurable Pipelines** - Define custom workflows (plan → code → review, code-only, etc.)
- 🔗 **Git Integration** - Clone repositories, make real code changes, create PRs on GitHub/Bitbucket
- 🎫 **Jira Integration** - Link tasks to Jira tickets with automatic commit message formatting
- 📡 **Real-time Logs** - Live terminal streaming via Socket.IO
- 🌙 **Dark Themed UI** - Modern React dashboard with responsive design
- 🧪 **Testing** - Unit tests for frontend components

## Project Structure

```
agent_orchestration/
├── src/                          # Frontend React/TypeScript
│   ├── components/
│   │   └── layout/
│   ├── pages/
│   │   ├── Activity.tsx
│   │   ├── Agents.tsx
│   │   ├── CreateTask.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Decompose.tsx
│   │   ├── Pipelines.tsx
│   │   └── Settings.tsx
│   ├── __tests__/
│   ├── App.tsx
│   └── main.tsx
├── server/                       # Backend Node.js
│   ├── agents/                   # AI agent implementations
│   │   ├── gemini.js
│   │   └── ollama.js
│   ├── pipelines/                # Pipeline YAML configs
│   │   ├── gemini-code-only.yaml
│   │   └── ollama-code-only.yaml
│   ├── workspaces/               # Temporary task workspaces
│   ├── engine.js                 # Core task processing logic
│   ├── index.js                  # Express API server
│   ├── worker.js                 # Background worker
│   ├── db.js                     # SQLite database
│   └── routes.js                 # API routes
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

Create a `.env` file in the root directory (or use `.env.agent_orchestration`):

```bash
# Jira Integration
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_USER=your-email@example.com
JIRA_API_TOKEN=your-jira-api-token

# Bitbucket Integration
BITBUCKET_USERNAME=your-username
BITBUCKET_APP_PASSWORD=your-app-password
BITBUCKET_TOKEN=your-access-token
BITBUCKET_HTTPS_TOKEN=your-https-token

# GitHub Integration
GITHUB_TOKEN=ghp_your-personal-access-token

# AI Agents
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-2.0-flash
OLLAMA_MODEL=qwen2.5-coder:1.5b
OLLAMA_HOST=http://localhost:11434

# Flask Socket.IO URL (if different from default)
FLASK_SOCKET_URL=http://localhost:5002
```

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

## Database Schema

The system uses SQLite with the following main tables:

- **tasks** - Task definitions with title, description, repository, pipeline, jira_ticket
- **executions** - Task execution records
- **stage_executions** - Individual pipeline stage executions
- **artifacts** - Generated artifacts from stages
- **pull_requests** - Created PR records
- **activity_log** - System activity tracking

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

Tasks can be created from Jira via the `/api/tasks/from-jira` endpoint:

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

## Frontend Development

### Theme Colors
Edit `src/index.css` to customize colors:
- Dark backgrounds: `#0f1419`, `#1f2236`, `#2d3142`
- Accent colors: Purple `#9d7fff`, Blue `#6b9eff`, Green `#4ade80`, Yellow `#fbbf24`, Red `#ff6b6b`

### Components
- **Sidebar** - Navigation menu with responsive mobile support
- **Header** - System status metrics with mobile menu toggle
- **RecentTasks** - Task list with status, agents, and PR links
- **CreateTask** - Task creation form with repository and pipeline selection
- **Dashboard** - Overview of system status and recent activity

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
- **AI Agents** - Gemini API, Ollama (local)

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

## Troubleshooting

### Worker not claiming tasks
- Ensure the worker process is running (`npm run worker`)
- Check that the backend server is running (`npm run server`)
- Verify the database has queued tasks

### No logs in browser terminal
- Ensure Flask Socket.IO server is running on port 5002
- Open the Task Details page before the worker starts processing
- Check browser console for Socket.IO connection errors

### Bitbucket PR creation fails
- Verify authentication tokens are set correctly
- Try different token types (BITBUCKET_HTTPS_TOKEN, BITBUCKET_TOKEN, BITBUCKET_APP_PASSWORD)
- Check repository URL format supports embedded usernames

## License

MIT
