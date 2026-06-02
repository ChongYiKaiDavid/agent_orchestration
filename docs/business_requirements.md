# Business Requirements

Overview
This project coordinates AI coding agents through configurable multi-stage pipelines. A user creates a task; the system runs agents (planner → coder → reviewer), produces a Pull Request (PR), and tracks it through merge.

Table of contents
- [Core Rule](#core-rule)
- [Roles](#roles)
- [Requirements](#requirements)

## Core Rule
Agents produce files; the Engine handles everything else.

## Roles
- **Agents**: Read input files, write output files (plans, code, reviews), and emit a completion token. No external side effects.
- **Engine**: Manages Git, state transitions, verdict routing, PR creation, session lifecycle, and the dashboard.

## Requirements

- **Centralized Project Dashboard**: A single UI where managers create high-level goals; the system breaks initiatives into manageable tasks and assigns them to Agents.

- **Safe Code Updates**: Agents operate in isolated workspaces. Only finalized, validated changes are submitted to the main repository.

- **Easy Workflow Customization**: Teams define workflow steps (e.g., Plan → Write Code → Review) via configuration (YAML) without changing core code.

- **Smart Task Ordering**: The system enforces correct sequencing and dependency checks so dependent work waits for foundational tasks.

- **Automatic Conflict Resolution**: On conflicting edits, the system detects clashes, generates a review/resolution task, and safely combines changes.

