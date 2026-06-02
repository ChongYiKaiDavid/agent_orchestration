# Client Architecture

Overview
This document describes the user-facing pages, user flows, and UI architecture for the orchestration system.

Table of contents
- [UI](#ui)
- [User Flows](#user-flows)
- [UI Architecture](#ui-architecture)

## UI
- **Dashboard Page**: Search tasks; view Task Progress (merge, respond, review, pending, working, done); Task Status (created, queued, running, done); Priorities (high, medium, low).
- **Create Task Page**: Create/Edit tasks (title, description, repository, pipeline selection).
- **Activity Page**: Recent task progress and activity log.
- **Agent Page**: CRUD Agents (name, description, model, prompt).
- **Pipeline Page**: CRUD Pipelines (stages list, agent for each stage, verdicts, YAML editor).
- **Repository Settings**: Configure repository connections and defaults.
- **PR Tracking**: View and link Pull Requests for tasks.

## User Flows

### 1. Task Creation Flow
- User opens Dashboard → Create Task.
- Inputs: title, description, repository, pipeline (e.g., plan-code-review).
- System creates: task record, execution record, queue entry. Status becomes `queued`.

### 2. Task Execution Flow (Automated)
- Worker picks task from queue; pipeline engine loads pipeline; execution starts.
- Stage sequence: Planner → Coder → Reviewer.
- System stores stage execution results and artifacts (code, logs, plans).
- Verdicts: `GO` (continue/finish), `FAIL` (rerun coder), `SPEC_FAIL` (return to planner), `ESCALATE` (human input).

### 3. Pull Request Creation Flow
- On `GO`, Engine commits to a feature branch, pushes, and creates a PR via provider API. Task status becomes `pr_created`.

### 4. Pull Request Review Flow (Human-in-the-loop)
- Reviewer comments on PR; provider webhook notifies system.
- System extracts comments as feedback, logs activity, and re-queues task at the coder stage with context.

### 5. Task Completion Flow
- PR approved and merged; PR monitor updates `pull_requests` and task status to `merged`. Execution marked complete; artifacts archived.

### 6. Failure & Retry Flow
- On `FAIL`, system checks retry limits and either re-runs the stage or marks the task failed and escalates.

### 7. Worker Lifecycle Flow
- Worker registers, heartbeats, claims tasks, executes stages, reports results. Recovery daemon re-queues tasks if heartbeats stop.

### 8. Pipeline Configuration Flow
- Admins define pipelines in YAML; system validates stages and ordering; pipelines become selectable in UI.

### 9. End-to-End Flow
- User creates task → Worker runs Planner→Coder→Reviewer → Code committed → PR created → Human review → Merge → Task completes.

## UI Architecture
- Pages → state → API → WebSocket (real-time updates)


Agent Types & Commands

Key Differences
API-based (Direct HTTP calls):

Claude Code, OpenAI Codex, Devin, Gemini, OpenClaw
CLI-based (Command-line execution):

GitHub Copilot — requires copilot CLI installed locally
OpenCode — uses custom CLI with base URL
Auth Modes:

API Key: Claude, Codex, OpenClaw, Devin, OpenCode
GitHub Token: Copilot (OAuth)
Vertex AI: Gemini (service account credentials)
Options per Agent:

Claude Code: Context window (200K/1M), effort level (low/medium/high), extended thinking (boolean)
Copilot: Reasoning effort (low/medium/high)
Others: Minimal/no configurable options
Free-text Models (custom values):
