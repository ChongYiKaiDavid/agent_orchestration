## Technical Requirements

Overview
Core architecture principles, functional requirements (FR), and non-functional requirements (NFR) for the orchestration system.

Table of contents
- [Core Architecture Principles](#core-architecture-principles)
- [Functional Requirements (FR)](#functional-requirements-fr)
- [Non-Functional Requirements (NFR)](#non-functional-requirements-nfr)

### Core Architecture Principles

- **Agents produce files; Engine manages state** — Agents are stateless utilities that read inputs and write artifacts (plans, code, reviews). The Engine manages Git, queuing, and routing.

- **Isolated environment sessions** — Run each pipeline stage in a fresh subprocess or container to eliminate cross-task context leaks.

- **Verdict-driven process routing** — Stages use exit tokens and structured reports; reviewer verdicts determine flow: `GO`, `FAIL`/`SPEC_FAIL`, `ESCALATE`.

- **Engine controls repository matrix** — Agents do not receive Git write keys; the Engine performs clones, branch management, rebases, commits, and PR creation.

### Functional Requirements (FR)

1. **YAML Workflow Compiler**
   - Parse pipeline templates (e.g., `plan-code-review.yaml`), validate agents, resolve DAG dependencies, and map stage I/O.

2. **Atomic Queue System**
   - Database-backed, lock-safe reservation layer enabling distributed workers to pick queued jobs without duplicate claims.

3. **Rebase-Before-Push Guardrail**
   - On successful review, Engine rebases target branch locally, squashes changes, and updates the PR to reduce merge conflicts.

4. **Conflict-Resolution Subroutine**
   - Spawn a specialized task/agent to resolve rebase conflicts before merging and pushing.

5. **Orphan Recovery Loop**
   - Watchdog scans for stale worker heartbeats, unlocks half-finished tasks, and returns them to the active queue.

6. **Automated PR Lifecycle Management**
   - Create PRs on `GO`; handle 409 conflicts by reusing existing PRs; poll for status changes and extract reviewer feedback from comments.

### Non-Functional Requirements (NFR)

- **Execution isolation** — Restrict or block network access inside agent containers to prevent data leakage.

- **State determinism** — Use SQLite for operational state to ensure reliable crash recovery.

- **Filesystem as source of truth** — Workspace filesystem stores artifacts (code, plans, diffs) reliably and consistently.

- **Enterprise compatibility** — Enforce UTF-8, offer proxy bypass options, and sanitize filesystem paths for constrained Windows corporate environments.
