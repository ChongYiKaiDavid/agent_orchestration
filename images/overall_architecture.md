# Overall System Architecture: A Deep Dive

The Agent Orchestration System is a sophisticated, multi-component platform engineered to automate and manage complex, multi-step tasks, particularly those found in software development and operations workflows. Its architecture is deliberately decoupled, emphasizing a clear separation of concerns to enhance scalability, maintainability, and resilience. The system facilitates a seamless flow from user interaction in a modern web interface, through a robust backend control plane, to asynchronous task execution by dedicated workers, with real-time feedback provided throughout the entire lifecycle.

This document provides an exhaustive breakdown of each component, their intricate relationships, and the key data flows that define the system's operation.

### Core Architectural Principles

- **Separation of Concerns:** Each major component has a single, well-defined responsibility. The API server handles business logic, the Worker handles execution, the Real-time Server handles communication, and the Frontend handles presentation. This separation prevents monolithic complexity.
- **Asynchronous, Non-Blocking Operations:** The system is built around a central, database-backed queue. The user-facing API can accept tasks instantly without waiting for them to complete. This ensures the UI remains responsive and the system can handle a high volume of requests.
- **Centralized State Management:** A single SQLite database acts as the source of truth. This simplifies data consistency and allows various components (which are themselves stateless) to coordinate their activities reliably. The database itself is the contract between the API server and the worker.
- **Real-time Feedback:** A dedicated WebSocket server provides immediate, real-time feedback to the user. This is critical for user experience, as it allows users to "watch" tasks execute live, providing transparency and confidence in the system.

***

### C4 Context Diagram for Agent Orchestration System

```mermaid
C4Context
  title Detailed System Architecture for Agent Orchestration

  Enterprise_Boundary(eb, "Agent Orchestration Platform") {

    Person(user, "Developer / Operator", "A user who defines, initiates, and monitors automated tasks via the web interface or CLI.")

    System(spa, "Frontend Web App", "React SPA (Vite, TypeScript)", "The primary user interface. Provides dashboards, a pipeline editor, and a real-time monitoring view for tasks.")
    System(cli, "Command-Line Interface", "Node.js (Commander)", "A headless interface for scripting, automation, and direct interaction with the orchestration engine.")

    System_Boundary(backend, "Backend Services") {
      Component(api, "API Server", "Node.js / Express.js", "The central control plane. Manages business logic, provides a REST API, and enqueues tasks by writing to the database.")
      Component(worker, "Task Worker", "Node.js Background Process", "The workhorse. Dequeues tasks from the database and executes them. Interacts with external services. Reports progress and logs.")
      Component(realtime, "Real-time Server", "Python / Flask-SocketIO", "Manages all WebSocket connections for streaming logs and notifications from the worker to the frontend.")
      Database(db, "Orchestration DB", "SQLite", "The single source of truth. Stores all data: tasks, pipelines, execution history, statuses, and logs. Also acts as the task queue.")
    }
  }

  System_Ext(git, "Git Provider", "e.g., GitHub, GitLab, Bitbucket", "External version control system. The worker clones code from and creates pull requests to these systems.")
  System_Ext(jira, "Jira / Issue Tracker", "e.g., Jira, Linear", "External project management tool. The API server can import issues to create new tasks.")

  Rel(user, spa, "Uses", "HTTPS")
  Rel(user, cli, "Executes commands")

  Rel(spa, api, "Makes API calls for state changes (REST/JSON)", "HTTPS")
  Rel(spa, realtime, "Subscribes to logs and notifications", "WebSocket")

  Rel(cli, api, "Makes direct function calls to engine")

  Rel(api, db, "Reads state and Writes (enqueues) tasks", "SQL")
  Rel(api, jira, "Imports issues to create tasks", "HTTPS")

  Rel(worker, db, "Dequeues tasks and Writes status updates/logs", "SQL")
  Rel(worker, git, "Clones repos, creates PRs", "Git/HTTPS")
  Rel(worker, realtime, "Forwards log messages for broadcast", "Socket.IO event")

  UpdateElementStyle(spa, $bgColor="#007bff", $fontColor="#ffffff")
  UpdateElementStyle(cli, $bgColor="#333333", $fontColor="#ffffff")
  UpdateElementStyle(api, $bgColor="#6f42c1", $fontColor="#ffffff")
  UpdateElementStyle(worker, $bgColor="#6f42c1", $fontColor="#ffffff")
  UpdateElementStyle(realtime, $bgColor="#28a745", $fontColor="#ffffff")
  UpdateElementStyle(db, $bgColor="#fd7e14", $fontColor="#ffffff")
  UpdateElementStyle(user, $bgColor="#6c757d", $fontColor="#ffffff")
```

***

### Exhaustive Component & Relationship Descriptions

#### People

*   **Developer / Operator (User)**
    *   **Description:** The user is the primary actor in the system. They are typically a technical user, such as a software developer, DevOps engineer, or a technically-inclined project manager.
    *   **Interactions:** They interact with the system via two main entry points: the **Frontend Web App** for a visual experience, or the **CLI** for automation and scripting. Their goal is to offload repetitive or complex tasks to the orchestration engine, such as running builds, deploying applications, or executing code analysis pipelines.

#### Core System Components

*   **Frontend Web App (`spa`)**
    *   **Technology:** A modern Single-Page Application built with React, TypeScript, and Vite.
    *   **Detailed Description:** This is the rich, interactive human interface for the platform. It is responsible for all presentational logic. Key features include a main dashboard for an at-a-glance overview of all recent tasks and their statuses, a detailed task view that includes metadata and a real-time log viewer (powered by Xterm.js), and a pipeline editor for defining and managing the stages of a task.
    *   **Communication Patterns:** The frontend communicates with the backend via two specialized channels. For all state-changing operations (creating a task, defining a pipeline) and data fetching (loading task history), it makes standard RESTful API calls (over HTTPS) to the **API Server**. For receiving live updates (log streams, status changes), it establishes a persistent WebSocket connection with the **Real-time Server**. This dual-channel approach is highly efficient, using the stateless request-response model for data and a stateful, low-latency connection for live events.

*   **Command-Line Interface (`cli`)**
    *   **Technology:** A Node.js script using the `commander` library.
    *   **Detailed Description:** The CLI provides a headless, scriptable interface to the orchestration engine. It bypasses the web UI and server, interacting directly with the core engine logic (`engine.js`). This makes it ideal for CI/CD integration, automated scripting, or for users who prefer a terminal-based workflow. It exposes commands to create, list, view, and monitor tasks. The `monitor` command is particularly powerful, as it can spawn a new terminal window to stream logs for a specific task, replicating the real-time experience of the web UI.

*   **API Server (`api`)**
    *   **Technology:** A Node.js application using the Express.js framework.
    *   **Detailed Description:** This is the central nervous system of the backend. It exposes a secure REST API that the frontend consumes. Its responsibilities include:
        1.  **Request Handling:** Receiving HTTP requests from the frontend.
        2.  **Business Logic:** Validating input, authorizing requests, and orchestrating the start of a new task.
        3.  **Task Enqueueing:** Its most critical function is to translate a "create task" request into a new record in the **Orchestration DB** with a `queued` status. This action effectively places the task onto a queue to be picked up by a worker. This is a fire-and-forget operation, allowing the server to respond to the user immediately.
        4.  **External Integrations:** It may connect to external services like Jira to fetch issue details to pre-populate task creation forms.

*   **Task Worker (`worker`)**
    *   **Technology:** A background Node.js process. It is not a long-running server but a script that can be instantiated to handle work.
    *   **Detailed Description:** This is the workhorse of the system, responsible for all "heavy lifting." It runs in a separate process from the API server. Its entire lifecycle is driven by the database.
        1.  **Dequeuing:** The worker polls the database at regular intervals, looking for tasks with the `queued` status.
        2.  **Execution:** Upon finding a task, it "claims" it by updating its status to `running`. It then begins executing the steps defined in the task's associated pipeline. This might involve cloning a Git repository, running `npm install`, executing a test suite, or calling other scripts.
        3.  **Reporting:** As it executes, it continuously updates the task's record in the database with its progress. More importantly, it forwards all `stdout` and `stderr` from its operations as structured log messages to the **Real-time Server**.
        4.  **Completion:** Upon completion (either success or failure), it sets the final status in the database and terminates.

*   **Real-time Server (`realtime`)**
    *   **Technology:** A Python server using Flask and the Flask-SocketIO extension, running on a `gevent` web server for high-performance asynchronous I/O.
    *   **Detailed Description:** This component is a specialized microservice with one job: manage real-time communication. By offloading this stateful, persistent connection management from the core Node.js application, the system becomes more robust.
        1.  **Connection Management:** It accepts and holds WebSocket connections from many different browser clients.
        2.  **Room-based Broadcasting:** When a client connects, it "joins" a room named after the `taskId` it is interested in.
        3.  **Log Relaying:** The **Task Worker** sends log events to this server. The server then broadcasts that event *only* to the clients within that specific `taskId` room. This is a highly efficient publish-subscribe model that ensures clients only receive the data they have subscribed to. This component is the key to providing a rich, real-time user experience.

*   **Orchestration Database (`db`)**
    *   **Technology:** A file-based SQLite database.
    *   **Detailed Description:** This database is the heart of the system, acting as both the persistent memory and the central message bus.
        1.  **Single Source of Truth:** It stores all canonical data: pipeline definitions, task details, execution history, and logs. All other components are designed to be stateless and rely on this database to function.
        2.  **Task Queue:** The `tasks` table serves as a simple and effective message queue. The **API Server** acts as the producer (writing new tasks), and the **Task Worker** acts as the consumer (reading and claiming tasks). This elegant design choice decouples the components completely.

### Key Interaction Workflows

#### Workflow 1: User Creates and Monitors a Task via Web UI

1.  **Initiation (Frontend):** The user fills out the "Create Task" form in the React SPA and clicks "Submit".
2.  **API Call (SPA -> API):** The SPA sends a `POST /api/tasks` request to the Node.js API Server with the task details in the JSON body.
3.  **Enqueueing (API -> DB):** The API Server validates the data and inserts a new row into the `tasks` table in the SQLite database. The `status` column for this new task is set to `"queued"`. The server then immediately returns a `201 Created` response to the SPA with the new task's ID.
4.  **Subscription (SPA -> Real-time Server):** The SPA navigates to the detail page for the new task. It then establishes a WebSocket connection to the Flask-SocketIO server and sends a `join-task` event, asking to be placed in the room identified by the `taskId`.
5.  **Dequeuing (Worker -> DB):** The Node.js Worker, in its polling loop, queries the database for tasks where `status = "queued"`. It finds the new task.
6.  **Execution (Worker):** The worker updates the task's status in the database to `"running"`. It then begins executing the pipeline.
7.  **Log Forwarding (Worker -> Real-time Server):** As the worker executes shell commands, it captures `stdout` and `stderr`. For each chunk of output, it emits an `agent-log` event over a socket connection to the Flask-SocketIO server, including the `taskId` and the log data.
8.  **Broadcasting (Real-time Server -> SPA):** The Flask server receives the `agent-log` event. It looks up the `taskId` and broadcasts the log data to all clients in that room.
9.  **Real-time Update (Frontend):** The SPA receives the broadcasted log data and appends it to the Xterm.js terminal view, allowing the user to see the output live.
10. **Completion (Worker -> DB):** Once the pipeline is finished, the worker updates the task's status in the database to `"completed"` or `"failed"` and writes a final report.

#### Workflow 2: User Creates a Task via CLI

1.  **Execution (User -> CLI):** The user runs `node cli.js create --title "My CLI Task" ...` in their terminal.
2.  **Direct Engine Call (CLI):** The `cli.js` script parses the arguments and directly calls the `createTask` function exported by the `server/engine.js` module. It does not go through the HTTP API.
3.  **Enqueueing (Engine -> DB):** The `createTask` function performs the same action as the API server: it inserts a new task record into the SQLite database with `status: "queued"`.
4.  **Continuation:** From this point, the workflow continues from **Step 5** in the Web UI workflow, with the worker picking up the task and executing it. If the user also runs `node cli.js monitor <taskId>`, the CLI will establish its own WebSocket connection to the Real-time Server to display the logs.
