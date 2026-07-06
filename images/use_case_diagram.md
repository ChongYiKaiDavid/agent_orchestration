# System Functionality: Use Case Diagram

This document describes the functional requirements of the Agent Orchestration System from a user-centric perspective. It identifies the key actors who interact with the system and the various use cases they can perform. A use case represents a specific goal that an actor can achieve by interacting with the system.

### Actor Definitions

An actor represents a role that a user or an external system plays when interacting with the platform.

-   **Developer / Operator (Primary Actor):** This is the main user of the system. Their primary goal is to automate and execute complex tasks. They are focused on the "what" and the "when" – what task to run and when to run it. They consume the pipelines and agents that are set up for them.

-   **System Administrator (Primary Actor):** This user is responsible for the configuration and maintenance of the orchestration platform itself. Their goal is to set up the reusable building blocks (pipelines, agents) that Developers will use. While a single person might act as both a Developer and an Admin, the roles are distinct in their goals.

-   **Git Provider (Secondary Actor):** This is an external system, such as GitHub, GitLab, or Bitbucket. The orchestration system interacts with it programmatically to perform version control operations.

-   **Jira / Issue Tracker (Secondary Actor):** This is an external project management system. The orchestration system interacts with it to import task details.

***

### Detailed Use Case Diagram

```mermaid
useCaseDiagram
    left to right direction

    actor "Developer / Operator" as Dev
    actor "System Administrator" as Admin

    rectangle "Agent Orchestration System" {
        usecase "Manage Tasks" as UC_Task
        usecase "View Task List" as UC_ViewList
        usecase "View Task Details" as UC_ViewDetails
        usecase "Monitor Real-time Execution" as UC_Monitor
        usecase "Create New Task" as UC_Create
        usecase "Import Task from Jira" as UC_Import

        usecase "Manage Pipelines" as UC_Pipeline
        usecase "View Pipeline Definitions" as UC_ViewPipes
        usecase "Define/Edit Pipeline" as UC_EditPipe
        
        usecase "Manage System Configuration" as UC_Config
        
        usecase "Execute Pipeline Stages" as UC_Execute
        usecase "Create Pull Request" as UC_CreatePR
        usecase "Clone Git Repository" as UC_CloneRepo
    }
    
    actor "Git Provider" as Git
    actor "Jira / Issue Tracker" as Jira

    ' --- Actor to Use Case Relationships ---
    Dev -- UC_Task
    Admin -- UC_Pipeline
    Admin -- UC_Config

    ' --- Use Case Decomposition ---
    UC_Task ..> UC_ViewList : extends
    UC_Task ..> UC_ViewDetails : extends
    UC_Task ..> UC_Create : extends
    
    UC_ViewDetails ..> UC_Monitor : includes
    UC_Create ..> UC_Import : extends

    UC_Pipeline ..> UC_ViewPipes : extends
    UC_Pipeline ..> UC_EditPipe : extends

    UC_Create -- UC_Execute
    UC_Execute ..> UC_CloneRepo : includes
    UC_Execute ..> UC_CreatePR : includes


    ' --- External System Interactions ---
    UC_Import -- Jira
    UC_CloneRepo -- Git
    UC_CreatePR -- Git

```
***

### Exhaustive Use Case Descriptions

#### **UC-01: Manage Tasks**
-   **Actor:** Developer / Operator
-   **Goal:** To create, view, and understand the status of all automated tasks. This is the primary day-to-day use case for a developer.
-   **Description:** This is a high-level use case that encompasses all the typical task-related activities a developer performs.
-   **Extends:** `View Task List`, `View Task Details`, `Create New Task`.

#### **UC-02: View Task List**
-   **Actor:** Developer / Operator
-   **Goal:** To get a high-level overview of all recent and ongoing tasks.
-   **Description:** The user accesses the main dashboard to see a list or Kanban board of all tasks in the system. They can see key information at a glance, such as the task title, its current status (`queued`, `running`, `completed`), and its priority. This allows them to quickly assess the overall state of the system.

#### **UC-03: View Task Details**
-   **Actor:** Developer / Operator
-   **Goal:** To inspect a single task in depth.
-   **Description:** From the task list, the user selects a single task to view its detailed information. This includes all its configuration parameters (like repository and branch), its full history of executions, and any artifacts it has produced.
-   **Includes:** `Monitor Real-time Execution`.

#### **UC-04: Monitor Real-time Execution**
-   **Actor:** Developer / Operator
-   **Goal:** To watch a task's progress as it happens.
-   **Description:** When viewing the details of a currently `running` task, the user is presented with a terminal-like view. This view streams the log output (`stdout`/`stderr`) from the Task Worker in real-time, providing immediate feedback and transparency into the execution process. This is crucial for debugging and for building confidence in the automation.

#### **UC-05: Create New Task**
-   **Actor:** Developer / Operator
-   **Goal:** To initiate a new job for the system to perform.
-   **Description:** The user fills out a form, providing all the necessary information for a new task, such as a title, a description, the target Git repository, and the specific pipeline to use. Upon submission, the task is placed in the queue, and the system takes over.
-   **Extends:** `Import Task from Jira`.

#### **UC-06: Import Task from Jira**
-   **Actor:** Developer / Operator
-   **Goal:** To create a new task quickly based on an existing issue in an external tracker.
-   **Description:** This is a specialization of `Create New Task`. The user can browse issues from an integrated Jira instance. When they select an issue to import, the system pre-populates the "Create New Task" form with the title and description from the Jira ticket, saving time and reducing manual entry.
-   **Interacts with:** Jira / Issue Tracker (Secondary Actor).

#### **UC-07: Manage Pipelines**
-   **Actor:** System Administrator
-   **Goal:** To create and maintain the reusable workflows that developers can use.
-   **Description:** This is a key administrative function. A pipeline is a template of ordered stages. The administrator is responsible for defining these templates, ensuring they are robust, and making them available to developers. This use case encapsulates the creation, editing, and deletion of these pipeline definitions.
-   **Extends:** `View Pipeline Definitions`, `Define/Edit Pipeline`.

#### **UC-08: View Pipeline Definitions**
-   **Actor:** System Administrator
-   **Goal:** To review all available workflows in the system.
-   **Description:** The administrator views a list of all defined pipelines and can inspect the stages and configuration of each one.

#### **UC-09: Define/Edit Pipeline**
-   **Actor:** System Administrator
-   **Goal:** To create a new workflow or modify an existing one.
-   **Description:** The administrator uses a UI, likely a text editor, to write or modify the YAML definition of a pipeline. They define the sequence of stages, the agent to be used for each stage, and the parameters that will be passed.

#### **UC-10: Manage System Configuration**
-   **Actor:** System Administrator
-   **Goal:** To configure the global settings of the orchestration platform.
-   **Description:** The administrator accesses a settings page where they can configure system-wide parameters, such as integrations with Git providers, Jira connection details, API keys, and other operational settings.

#### **UC-11: Execute Pipeline Stages**
-   **Actor:** The System (specifically, the Task Worker)
-   **Goal:** To carry out the steps defined in a task's pipeline.
-   **Description:** This is a backend-only use case triggered by `Create New Task`. Once a task is claimed by a worker, the system begins executing the stages of the chosen pipeline in sequence.
-   **Includes:** `Clone Git Repository`, `Create Pull Request`.

#### **UC-12: Clone Git Repository**
-   **Actor:** The System
-   **Goal:** To get a local copy of the code that needs to be worked on.
-   **Description:** As part of a pipeline execution, the system will often need to interact with a code repository. This use case represents the action of cloning that repository into the worker's local workspace.
-   **Interacts with:** Git Provider (Secondary Actor).

#### **UC-13: Create Pull Request**
-   **Actor:** The System
-   **Goal:** To submit the results of a task for human review.
-   **Description:** After a task has modified code (e.g., code generation or automated refactoring), a common final step in the pipeline is for the system to automatically create a pull request on the target Git provider.
-   **Interacts with:** Git Provider (Secondary Actor).
