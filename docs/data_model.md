# Data Model

Overview
Primary data model for the system (SQLite). Each section describes a table and core fields.

Table of contents
- [Users](#users)
- [Repositories](#repositories)
- [Pipelines](#pipelines)
- [Tasks](#tasks)
- [Executions](#executions)
- [Stage Executions](#stage-executions)
- [Artifacts](#artifacts)
- [Pull Requests](#pull-requests)
- [Activity Log](#activity-log)

## Users
Stores system users who create and manage tasks.
- `id`: unique identifier
- `email`: user email
- `name`: display name
- `role`: user role (admin, developer, reviewer)
- `created_at`: timestamp

## Repositories
Linked source code repositories.
- `id`: repository identifier
- `name`: repository name
- `provider`: git provider (Bitbucket/GitHub)
- `url`: repository URL
- `default_branch`: main branch name
- `created_at`: timestamp

## Pipelines
Defines execution workflows for tasks.
- `id`: pipeline identifier
- `name`: pipeline name
- `version`: pipeline version
- `definition_json`: structure of stages (planner → coder → reviewer)
- `created_at`: timestamp

## Tasks
Represents a user request to run a pipeline.
- `id`: task identifier
- `title`: task title
- `description`: task description
- `status`: new, running, completed, failed, merged
- `priority`: execution priority
- `repository_id`: linked repository
- `pipeline_id`: assigned pipeline
- `created_at`, `updated_at`: timestamps

## Executions
Tracks one full run of a pipeline for a task.
- `id`: execution identifier
- `task_id`: linked task
- `pipeline_id`: pipeline used
- `status`: running, completed, failed
- `started_at`, `completed_at`: timestamps

## Stage Executions
Results for each pipeline stage.
- `id`: stage execution identifier
- `execution_id`: linked execution
- `stage_name`: planner, coder, reviewer
- `status`: running, completed, failed
- `input_data`, `output_data`: serialized I/O
- `started_at`, `completed_at`: timestamps

## Artifacts
Outputs generated during execution.
- `id`: artifact identifier
- `execution_id`: linked execution
- `type`: plan, code, review, log, pr_link
- `file_path`: location in workspace
- `metadata`: extra information
- `created_at`: timestamp

## Pull Requests
Tracks PR lifecycle in Bitbucket or GitHub.
- `id`: PR identifier
- `execution_id`: linked execution
- `repo_id`: repository
- `pr_number`: provider PR number
- `url`: PR URL
- `status`: open, changes_requested, approved, merged
- `merged_at`: timestamp

## Activity Log
System events for debugging and audit.
- `id`: log identifier
- `task_id`: related task
- `event_type`: queue, webhook, stage_update, error
- `message`: event description
- `created_at`: timestamp

Data flow summary: Task → Execution → Stage Executions → Artifacts → Pull Request → Activity Log
