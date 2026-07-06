# Server-Side Architecture: A Deep Dive

The backend of the Agent Orchestration platform is a sophisticated, polyglot system designed around the principles of a microservices-like architecture. It emphasizes a strong separation of concerns, fault isolation, and the use of the best technology for each specific job. The architecture is primarily composed of two distinct services that run in separate processes: a **Node.js Orchestration Service** that forms the core business logic and API layer, and a **Python Real-time Service** dedicated exclusively to managing high-concurrency, low-latency communication with clients.

This document provides an exhaustive breakdown of the internal structure of these services, their responsibilities, and the key interaction patterns that govern their operation.

### Architectural Principles

-   **Polyglot Architecture:** The system deliberately uses two different language stacks. Node.js is leveraged for its high-performance, non-blocking I/O, making it ideal for a JSON-heavy REST API and orchestrating file system or shell operations. Python, combined with `gevent` and `Flask-SocketIO`, is used for its mature and highly efficient handling of thousands of concurrent WebSocket connections, a task that can be challenging in other stacks.
-   **Asynchronous by Default:** The entire task execution workflow is asynchronous. The API server's primary role is to accept and queue tasks, providing an immediate response to the client. The actual work is performed later by a separate worker process, ensuring the API remains fast and responsive.
-   **Database as a Message Queue:** The system uses the central SQLite database not just for persistence but as a simple, robust message bus. The API server acts as a "producer," writing tasks to a table, while the worker acts as a "consumer," reading from it. This completely decouples the two main components of the Node.js service.
-   **Fault Isolation & Resilience:** Because the API server, worker, and real-time server are separate processes (and could even be run on separate machines), the failure of one component does not necessarily bring down the entire system. If the worker fails, tasks will queue up but the API remains available. If the real-time server fails, logs will not be streamed, but the core task execution can continue.

***

### C4-Style Component Diagram for Backend Services

This diagram details the internal components of the two main backend services and their interactions.

```mermaid
C4Component
  title Backend Services Component Architecture

  System_Ext(frontend, "Frontend SPA", "React")
  System_Ext(db, "Orchestration DB", "SQLite")

  Boundary(node_service, "Node.js Orchestration Service") {
    Component(api, "API Server", "index.js (Express.js)", "Provides the REST API. Handles all incoming client requests for data and task creation.")
    Component(routes, "Router", "routes.js", "Maps API endpoints to controller logic. Acts as the main entry gate.")
    Component(engine, "Orchestration Engine", "engine.js", "The core business logic. Manages task state transitions and execution orchestration.")
    Component(worker, "Task Worker", "worker.js", "The main loop for the worker process. Dequeues and executes tasks via the engine.")
    Component(dal, "Data Access Layer", "db.js", "Abstracts all SQL queries and communication with the SQLite database.")
  }

  Boundary(python_service, "Python Real-time Service") {
    Component(socket_server, "WebSocket Server", "app.py (Flask-SocketIO)", "Manages all client WebSocket connections and handles real-time event broadcasting.")
  }

  Rel(frontend, api, "Makes API calls to", "JSON/HTTPS")
  Rel(frontend, socket_server, "Establishes connection", "WebSocket")

  Rel(api, routes, "Uses")
  Rel(routes, engine, "Delegates business logic to")
  Rel(engine, dal, "Reads/Writes state via")
  Rel(worker, engine, "Uses to process tasks")
  Rel(dal, db, "Reads/Writes data", "SQL")

  // The crucial link for real-time logs
  Rel(engine, socket_server, "Forwards log events to", "Socket.IO event")

  UpdateElementStyle(node_service, $bgColor="#E5E5E5")
  UpdateElementStyle(python_service, $bgColor="#DAF7A6")
```

***

### Exhaustive Component & Module Breakdown

### A. The Node.js Orchestration Service

This service is the application's backbone, written in Node.js. It can be run as a single, monolithic process (API server with an integrated worker loop) or as two separate processes (a dedicated API server and one or more dedicated workers), providing deployment flexibility.

#### `index.js` - API Server Entry Point
-   **Responsibility:** This file bootstraps and runs the Express.js web server. It configures middleware (like `cors` and `express.json`), imports and applies the API endpoint definitions from `routes.js`, and starts listening for HTTP requests. It can also optionally start an in-process worker loop for simple, all-in-one deployments.

#### `routes.js` - The API Gateway
-   **Responsibility:** This is a comprehensive router file that defines every single REST API endpoint available in the system (e.g., `POST /api/tasks`, `GET /api/pipelines/:id`). It acts as a thin controller layer. Its job is to receive an incoming request, perform basic validation, call the appropriate function in the `engine.js` or `db.js` modules to handle the business logic, and then format the result into a JSON response to send back to the client.

#### `engine.js` - The Core Orchestration Engine
-   **Responsibility:** This massive file is the true "brain" of the application. It contains all the complex business logic for managing the entire lifecycle of a task.
-   **Key Functions:**
    -   `createTask()`: Contains the logic for validating and initializing a new task before it's saved to the database.
    -   `claimQueuedTask()`: The function called by the worker to find and atomically lock a task from the database queue.
    -   `processTask()`: The main execution function. Once a worker has claimed a task, this function is called. It reads the task's associated pipeline, and iterates through its defined steps, executing them one by one. This can involve spawning child processes to run shell commands, interacting with the file system, or calling other modules like `pr-poller.js`.
    -   **Log Forwarding:** A critical behavior within `processTask` is its handling of logs. As it runs commands, it captures `stdout` and `stderr`. For each piece of output, it establishes a *client* connection to the Python WebSocket server and emits an `agent-log` event, effectively "forwarding" the log message for broadcasting.

#### `worker.js` - The Worker Entry Point
-   **Responsibility:** This script is the entry point for running a dedicated, out-of-process worker. Its primary function is to run a continuous loop that repeatedly calls `claimQueuedTask()` and, if a task is found, `processTask()` from the `engine.js` module. Running workers as separate processes is key to the system's scalability and resilience.

#### `db.js` - The Data Access Layer (DAL)
-   **Responsibility:** This module implements the Data Access Layer pattern. It is the *only* part of the application that directly communicates with the `better-sqlite3` database. It abstracts all SQL queries into simple, semantic functions like `getTaskById(id)`, `updateTaskStatus(id, status)`, etc. This isolates the business logic in `engine.js` from the data storage details, making the code cleaner and easier to maintain or migrate to a different database in the future.

#### Specialized Subsystems
-   **Pipeline Subsystem (`pipelines.js`, `pipeline-loader.js`):** A collection of modules that provide a full-featured system for creating, managing, and executing reusable task templates (Pipelines).
-   **Feature Modules (`pr-poller.js`, `conflict-resolver.js`):** These modules contain logic for advanced features, such as polling Git providers for the status of pull requests or attempting to automatically resolve code conflicts.

### B. The Python Real-time Service

This service is a highly specialized microservice with a single, clear purpose.

#### `app.py` - The Flask-SocketIO Server
-   **Responsibility:** To efficiently manage all real-time, bidirectional communication with clients.
-   **Technology Choice:** The choice of Python with Flask-SocketIO and a `gevent` worker is deliberate. `gevent` uses non-blocking sockets and greenlets to handle thousands of concurrent connections with very low memory overhead, making it exceptionally well-suited for a scenario where many clients may be connected but are only receiving data intermittently (i.e., when a task they are watching is active).
-   **Event Handlers:**
    -   `on_connect`: A new client has connected.
    -   `on_disconnect`: A client has disconnected.
    -   `on_join_task`: A client sends this event after connecting, providing a `taskId`. The server then adds this client's connection to a "room" named after the `taskId`.
    -   `on_agent_log` / HTTP endpoint: This is the entry point for the Node.js worker. When the worker sends a log message, the Flask server receives it, identifies the `taskId`, and broadcasts the message *only* to the clients in that specific task's room. This room-based broadcasting is the key to its efficiency.

### Key Backend Interaction Scenarios

#### Scenario 1: API Request to Create a Task
1.  **Ingress:** A `POST /api/tasks` request from the frontend arrives at the Node.js `index.js` server and is passed to the Express app.
2.  **Routing:** `routes.js` matches the endpoint and calls the corresponding handler function.
3.  **Engine Logic:** The handler calls `createTask()` in `engine.js`.
4.  **Persistence:** `engine.js` validates the task data and calls a function like `insertTask()` in `db.js`.
5.  **Database Write:** `db.js` executes an `INSERT INTO tasks ...` SQL statement against `db.sqlite`, setting the initial `status` to `"queued"`.
6.  **Response:** The new task's ID bubbles back up the call stack, and `routes.js` sends a `201 Created` JSON response to the client. The request is now complete from the client's perspective.

#### Scenario 2: Worker Processing a Task and Streaming Logs
1.  **Polling:** The `worker.js` process, in its main loop, calls `claimQueuedTask()` from `engine.js`.
2.  **Atomic Operation:** `engine.js` delegates to `db.js`, which executes an atomic transaction to find the first task with `status = "queued"` and update its `status` to `"running"`. It returns the task object.
3.  **Execution Start:** The worker loop receives the task object and immediately calls `processTask(task)` in `engine.js`.
4.  **Sub-process Execution:** `engine.js` spawns a child process to run a command (e.g., `git clone ...`). It attaches listeners to the child process's `stdout` and `stderr`.
5.  **Log Forwarding:** When the `stdout` listener fires with new data, `engine.js` creates a temporary Socket.IO client, connects to the Python `app.py` server, and emits an `agent-log` event containing the `taskId` and the log data.
6.  **Broadcasting:** The Python server receives the `agent-log` event, looks at the `taskId`, and broadcasts the data to every client currently in the corresponding room.
7.  **Completion:** When the child process finishes, `processTask` continues to the next step. Once all steps are done, it calls `updateTaskStatus()` in `engine.js`, which uses `db.js` to set the task's final status to `"completed"` or `"failed"`. The worker loop then begins again, looking for another task.
