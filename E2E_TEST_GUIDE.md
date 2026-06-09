# End-to-End Test Guide

This guide walks you through manually testing the full Agent Orchestration application from start to finish.
---

## 0. Prerequisites

Before testing, install the dependencies:

```bash
cd agent_orchestration
npm install
```

### Required CLI Tools

| Agent | Expected CLI Name | Env Variable | Notes |
|-------|------------------|--------------|-------|
| Devin | `devin.exe` (Win) / `devin` (Mac/Linux) | `DEVIN_PATH` | Falls back to PATH lookup |
| Gemini | `gemini.cmd` / `gemini` | `GEMINI_PATH` | Falls back to PATH lookup |

```powershell
$env:DEVIN_PATH = "C:\path\to\devin.exe"
$env:GEMINI_PATH = "C:\path\to\gemini.cmd"
```

---

## 1. Architecture Overview


The application runs in **3 processes** simultaneously:

1. **Frontend** - React UI at `http://localhost:5173`
2. **Backend Server** - Express API at `http://127.0.0.1:5174`
3. **Background Worker** - Polls for queued tasks and executes them

---

## 2. Starting the Application


### Terminal 1 - Frontend UI
```bash
cd agent_orchestration
npm run dev
```
Open your browser to **http://localhost:5173**.

### Terminal 2 - Backend API Server
```bash
cd agent_orchestration
npm run server
```
> Backend server listening on http://127.0.0.1:5174

### Terminal 3 - Background Worker
```bash
cd agent_orchestration
npm run worker
```
> Worker loop started.

---

## 3. Test 1 - API Health Check

```bash
curl http://127.0.0.1:5174/
# Expected: Agent Orchestration Engine is running.


curl http://127.0.0.1:5174/api/pipelines
# Expected: JSON array of 5 pipeline definitions

curl http://127.0.0.1:5174/api/agents
# Expected: JSON array with devin and gemini agents
```

---

## 4. Test 2 - Auto-Selection Logic


This test verifies automatic pipeline and agent selection **without** needing Devin or Gemini CLI installed.

### Via API

```bash
# Test auto-select for a coding task
curl -X POST http://127.0.0.1:5174/api/tasks/auto-select ^
  -H "Content-Type: application/json" ^
  -d "{\"title\":\"Add user authentication feature\",\"description\":\"Implement login and logout functionality\"}"

# Expected: pipelineId = "hybrid-gemini-devin", selectedAgent = "devin"

# Test auto-select for a planning task
curl -X POST http://127.0.0.1:5174/api/tasks/auto-select ^
  -H "Content-Type: application/json" ^
  -d "{\"title\":\"Create architecture plan\",\"description\":\"Design the system architecture\"}"
# Expected: pipelineId = "gemini-plan-code-review", selectedAgent = "gemini"

# Test auto-select for a simple docs task
curl -X POST http://127.0.0.1:5174/api/tasks/auto-select ^
  -H "Content-Type: application/json" ^
  -d "{\"title\":\"Update README\",\"description\":\"Add documentation for the API\"}"
# Expected: pipelineId = "gemini-code-only", selectedAgent = "gemini"
```

### Via Node.js Script (No API Server Needed)

```bash
cd agent_orchestration
node --input-type=module << ENDSCRIPT
import { autoSelectPipelineAndAgent } from './server/auto-selector.js';

const tests = [
  { title: "Add user authentication", description: "Implement login and logout", expectedAgent: "devin", expectedType: "coding" },
  { title: "Create architecture plan", description: "Design the system architecture", expectedAgent: "gemini", expectedType: "planning" },
  { title: "Fix critical bug", description: "Checkout flow fails with PayPal", expectedAgent: "devin", expectedType: "coding" },
  { title: "Update README", description: "Add documentation for new endpoints", expectedAgent: "gemini", expectedType: "docs" },
  { title: "Migrate to microservices", description: "Redesign entire system", expectedAgent: "devin", expectedType: "coding" },
];

let passed = 0, failed = 0;
for (const test of tests) {
  const result = autoSelectPipelineAndAgent(test);
  const ok = result.selectedAgent === test.expectedAgent && result.reasoning.taskType === test.expectedType;
  console.log((ok ? "PASS" : "FAIL") + ": " + test.title + " => " + result.selectedAgent + " + " + result.pipelineId + " (" + result.reasoning.taskType + ")");
  ok ? passed++ : failed++;
}
console.log("\nResults: " + passed + " passed, " + failed + " failed");
ENDSCRIPT
```

---

## 5. Test 3 - Create a Task (Without Agent Execution)

```bash
# Create a task with full auto-selection
curl -X POST http://127.0.0.1:5174/api/tasks ^
  -H "Content-Type: application/json" ^
  -d "{\"title\":\"Test auto-select\",\"description\":\"Testing automatic pipeline selection\"}"

# Create a task with explicit auto pipeline
curl -X POST http://127.0.0.1:5174/api/tasks ^
  -H "Content-Type: application/json" ^
  -d "{\"title\":\"Test explicit auto\",\"description\":\"Testing\",\"pipeline\":\"auto\"}"

# Check the task list
curl http://127.0.0.1:5174/api/tasks

# Check events
curl http://127.0.0.1:5174/api/events
```

---

## 6. Test 4 - Full Pipeline Execution (Requires CLI Tools)

### Prerequisites
```powershell
devin --help
# or
gemini --help
```

### Create and Execute a Task

**UI Method:** http://localhost:5173 > Create Task > Enter details > Create & Queue


**API Method:**
```bash
curl -X POST http://127.0.0.1:5174/api/tasks ^
  -H "Content-Type: application/json" ^
  -d "{\"title\":\"Write a hello world function\",\"description\":\"Create a simple hello world in Python\",\"pipeline\":\"code-only\"}"
```

### Monitor Execution

Watch Terminal 3 (Worker) for logs:
```
Worker claimed task <id>
Stage Coding started.
... (agent output)
Stage Coding completed.
```

### Check Results
```bash
# Check workspace folder
cd agent_orchestration/server/workspaces
# <task-id>/coding/prompt.txt   <- Instructions given to agent
# <task-id>/coding/output.txt  <- Agent response

# Check task executions
curl http://127.0.0.1:5174/api/tasks/<TASK_ID>/executions
```

---

## 7. Available Pipelines

| ID | Name | Stages | Agent |
|----|------|--------|-------|
| `code-only` | Code Only | Coding | Devin |
| `plan-code-review` | Plan -> Code -> Review | Planning, Coding, Reviewing | Devin |
| `gemini-code-only` | Gemini Code Only | Coding | Gemini |
| `gemini-plan-code-review` | Gemini Plan -> Code -> Review | Planning, Coding, Reviewing | Gemini |
| `hybrid-gemini-devin` | Hybrid: Gemini Plan -> Devin Code -> Review | Planning (Gemini), Coding (Devin), Reviewing (Gemini) | Mixed |

---

## 8. Running Unit Tests


```bash
cd agent_orchestration
npm test
```

**Current Status:**
- API tests: 5/5 passing
- Component tests: Pre-existing Vite plugin configuration issue (not related to recent changes)

**Server syntax verification:**
```bash
node --check server/auto-selector.js
node --check server/engine.js
node --check server/routes.js
node --check server/pipelines.js
```

---

## 9. Troubleshooting

| Problem | Solution |
|---------|----------|
| Worker not picking up tasks | Verify worker is running. Check Terminal 3 for errors. |
| Agent CLI not found | Set `$env:DEVIN_PATH` or `$env:GEMINI_PATH` before starting server |
| Server fails to start | Check if port 5174 is in use: `netstat -ano | findstr 5174` |
| Database errors | Delete `server/db.sqlite` and restart the server |

---


## 10. Quick Test Checklist

- [ ] `npm run dev` - Frontend starts on port 5173
- [ ] `npm run server` - Backend starts on port 5174
- [ ] `npm run worker` - Worker loop starts
- [ ] `curl http://127.0.0.1:5174/` - Health check OK
- [ ] `curl http://127.0.0.1:5174/api/pipelines` - Returns 5 pipelines
- [ ] `curl http://127.0.0.1:5174/api/agents` - Returns devin and gemini
- [ ] `/api/tasks/auto-select` - Returns auto-selection result
- [ ] `/api/tasks` - Creates task with auto-assigned pipeline
- [ ] `npm test` - API tests pass (5/5)
- [ ] (With CLI tools) Create real task and verify pipeline execution
