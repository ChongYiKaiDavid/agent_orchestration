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

## Detailed End-to-End Flow (Expanded)

This expanded sequence explains what the system does at each stage, which database rows are written or updated, and which code modules perform the work.

1) User submits a Task (UI → API)
- UI: user fills title, description, repository, pipeline and clicks Create Task.
- API: `server/app.py` receives the POST and creates a `Task` row in SQLite (`tasks` table) with `status = queued`.
- API also creates an `Execution` row (`executions` table) with `status = running` and links it to the new `Task`.

2) Task is Queued (Engine state)
- The task remains visible to workers by its `status = queued` and the Engine's queue/reservation layer (implicit in the current scaffold).
- Database: `tasks.status` = `queued`, `executions.status` = `running`.

3) Worker claims the Task (Worker loop)
- Worker polls for queued tasks (worker loop to be implemented; intended location: `scripts/run_worker.py`).
- On claim the worker updates `tasks.status` = `running` and records claim metadata in `activity_log`.

4) Pipeline Load and Stage Preparation
- The worker loads the pipeline YAML via `server/pipeline.py` (parses `pipelines/*.yaml`).
- For each stage the engine prepares a fresh workspace directory on the filesystem (files written here are the canonical artifacts).
- Engine creates a `StageExecution` row (`stage_executions`) with `status = running`, and `input_data` capturing serialized inputs for traceability.

5) Agent Execution (Planner / Coder / Reviewer)
- The engine dispatches the stage to the configured agent via `agents/runner.py`.
- Phase 1 agent: `DevinAgent` (`agents/devin.py`) — runs the `devin` CLI in the stage workspace and captures stdout/stderr.
- Agent outputs (files like `plan.md`, `code.diff`, `review.md`) are saved into the workspace.

6) Persisting Stage Results and Artifacts
- After completion the engine updates `stage_executions`:
	- `status` = `completed` or `failed`
	- `output_data` = agent response (text, verdict, short metadata)
	- `completed_at` timestamp
- For each produced file the engine inserts an `Artifact` row (`artifacts` table) recording `execution_id`, `type` (plan/code/review), `file_path`, and optional `metadata`.

7) Verdict Evaluation and Routing
- For reviewer stages, engine inspects `review.md` (or agent `output_data`) and extracts a standardized verdict: `GO`, `FAIL`, `SPEC_FAIL`, or `ESCALATE`.
- Routing rules:
	- `GO` → proceed to PR creation and finish
	- `FAIL` → set the `coder` stage to re-run (update relevant `stage_executions`, increment retry counters)
	- `SPEC_FAIL` → re-run the `planner` stage
	- `ESCALATE` → pause execution and create an `activity_log` entry for human intervention
add a unit test per task
8) Git Operations and Pull Request Lifecycle (Engine-only)
- The Engine (not agents) performs all Git interactions (design principle: Engine Git Supremacy). The Git work is implemented in the Engine module(s) (planned under `server/engine.py`).
- Steps on `GO`:
	- Create a feature branch in a fresh clone of the target repository
	- Apply the generated diffs or copy generated files into the working tree
	- Commit, push the branch, and create a PR via the provider API (GitHub/Bitbucket)
- A `PullRequest` row (`pull_requests`) is created/updated with `pr_number`, `url`, `status`, and `merged_at` when applicable.

9) Human Review and Feedback Loop
- Reviewers inspect the PR in the provider UI. The Engine monitors PRs via polling or webhooks (polling preferred initially).
- New comments, reviews, and status changes are recorded in `activity_log` and may add entries to `stage_executions.output_data` or create new `Artifact` rows with reviewer comments.
- If the review requests changes, the Engine re-queues or re-runs the `coder` stage with reviewer context.

10) Merge and Task Completion
- When the PR is merged the PR status becomes `merged` and `pull_requests.merged_at` is set.
- The Engine updates `tasks.status` = `merged` and `executions.status` = `completed` and archives the workspace artifacts.

11) Operational Safety, Observability & Recovery
- State: SQLite (`server/db.py`) is the operational source of truth for all runtime objects (tasks, executions, stage executions, artifacts, pull requests, activity logs).
- Filesystem: The stage workspace directories are the authoritative artifact store (diffs, generated files, logs).
- Recovery: a watchdog/recovery loop scans heartbeats and stale `running` states, writes `activity_log` entries, and re-queues or marks tasks failed as appropriate.

12) UI: Polling Model
- The UI polls the Engine API (`server/app.py`) for task/execution/stage status. Endpoints return task rows (`tasks`), execution progress (`executions` + `stage_executions`), artifacts (`artifacts`), and PR links (`pull_requests`).

Mapping of key tables and fields (quick reference):
- `tasks` — `id`, `title`, `description`, `status`, `repository_id`, `pipeline_id`, timestamps
- `executions` — `id`, `task_id`, `pipeline_id`, `status`, `started_at`, `completed_at`
- `stage_executions` — `id`, `execution_id`, `stage_name`, `status`, `input_data`, `output_data`, timestamps
- `artifacts` — `id`, `execution_id`, `type`, `file_path`, `metadata`, `created_at`
- `pull_requests` — `id`, `execution_id`, `repo_id`, `pr_number`, `url`, `status`, `merged_at`
- `activity_log` — audit trail of events and errors for debugging and operator visibility

Files of interest in this scaffold:
- `server/app.py` — REST API endpoints (task creation, status retrieval)
- `server/models.py` — SQLAlchemy ORM models that store runtime state
- `server/db.py` — SQLite engine and session setup
- `server/pipeline.py` — pipeline YAML parsing and stage modeling
- `agents/runner.py` — agent registry and dispatching
- `agents/devin.py` — `Devin` CLI adapter used for Phase 1
- `pipelines/*.yaml` — pipeline templates (e.g., `plan_code_review.yaml`)
- `scripts/run_server.py` — simple server runner; `scripts/run_worker.py` will host the worker loop
