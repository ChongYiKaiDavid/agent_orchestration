
# Design Principles

Overview
High-level principles guiding system architecture and engineering decisions.

Table of contents
- [Independent Execution](#independent-dependency-free-execution)
- [Extensible Foundation](#built-for-one-designed-for-many)
- [Separation of Concerns](#strict-separation-of-concerns)
- [Engine Git Supremacy](#engine-git-supremacy)
- [Context Isolation](#total-context-isolation)
- [Verdict-Driven Loops](#verdict-driven-feedback-loops)
- [State Determinism](#state-determinism-and-filesystem-supremacy)

### 1. Independent, Dependency-Free Execution
For the MVP, favor execution speed over complex orchestration. Tasks are treated as isolated, standalone units of work. Removing DAG dependencies enables faster processing by priority without waiting for external blockers.

### 2. Built for One, Designed for Many (Extensible Foundation)
Operate under a single-project focus initially to simplify Git and API logic, while designing the schema and architecture to be multi-tenant-ready for future scaling.

### 3. Strict Separation of Concerns (Agents Compute, Engine Orchestrates)
Agents are stateless utilities limited to reading inputs, writing outputs, and signaling completion. The Engine manages databases, queues, Git, and routing logic.

### 4. Engine Git Supremacy (Zero-Trust Agents)
Treat agents as untrusted: sandbox them from repository credentials. The Engine performs all clones, branch management, rebases, commits, and PR creation.

### 5. Total Context Isolation
Each pipeline stage runs in a freshly initialized subprocess or container with zero shared memory between stages to prevent data leakage or hallucinations.

### 6. Verdict-Driven Feedback Loops
Workflow is dictated by standardized verdicts (`GO`, `FAIL`, `SPEC_FAIL`, `ESCALATE`) returned by reviewers, enabling dynamic, self-correcting execution.

### 7. State Determinism and Filesystem Supremacy
Operational state is stored in SQLite for reliable recovery. The workspace filesystem is the immutable source of truth for generated artifacts (code, plans, diffs).


