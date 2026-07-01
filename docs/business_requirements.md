


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

-change colour
-add pr link, name and description on dashboard only
-add jira demo or free jira included inside this app so it has to show as jira story or jira task as well
-add editing for the agents, for example, different files for devin, codex etc, dont hardcode the agents -p, should be in the configuration each cli perimeter should be in the configuration file Agent page should not show display name, should show planner, reviewer, coder etc add skill as well
-add a more detailed prompt for agent page
-define cli in the pipeline page, find another agent like gemini, deepseek etc dont use ollama local llm
-each tasks must have target branch (release branch) When to release etc
-For each task must checkout the code on the release branch, create a future branch for the release branch and implement code on release branch and create pr and merge on release branch(should be configurable as well)by default it is enabled
-create jira and checkout to get the jira key then do the tasks create pr 
-put all configurations into the setting page

    
