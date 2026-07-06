# System Interaction: Sequence Diagram

This document provides a detailed, step-by-step visualization of the most critical user flow in the Agent Orchestration system: **Creating and Monitoring a Task in Real-Time**. This sequence diagram illustrates how all the major components of the architecture—from the user's browser to the backend services—collaborate over time to accomplish this task.

### The Scenario

The sequence begins when a user has filled out the "New Task" form in the web UI and clicks "Submit." It ends when the task has completed and the user has seen the final result.

***

### Detailed Interaction Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant Frontend as React SPA
    participant API_Server as API Server (Node.js)
    participant DB as Orchestration DB (SQLite)
    participant Worker as Task Worker (Node.js)
    participant Realtime_Server as Real-time Server (Python)

    title Detailed Task Creation and Monitoring Flow

    %% 1. Task Creation
    box LightCyan "Phase 1: Task Creation & Enqueueing"
        User->>+Frontend: 1. Clicks 'Create Task'
        Frontend->>+API_Server: 2. POST /api/tasks (taskData)
        API_Server->>+DB: 3. INSERT INTO tasks (..., status='queued')
        DB-->>-API_Server: 4. Returns new task record
        API_Server-->>-Frontend: 5. 201 Created (newTask)
        Frontend-->>-User: 6. Navigates to Task Detail Page
    end

    %% 2. Real-time Subscription
    box LightYellow "Phase 2: Real-time Log Subscription"
        Frontend->>+Realtime_Server: 7. Establishes WebSocket Connection
        Realtime_Server-->>-Frontend: 8. Connection Acknowledged
        Frontend->>Realtime_Server: 9. Emits 'join-task' event (taskId)
        note right of Realtime_Server: Server adds client to a room for this taskId.
    end

    %% 3. Worker Dequeueing and Execution
    box LightGreen "Phase 3: Worker Dequeueing and Execution"
        Worker->>+DB: 10. Polls for work: SELECT ... WHERE status='queued'
        DB-->>-Worker: 11. Returns queued task record
        
        note over Worker, DB: The worker now "claims" the task atomically.
        Worker->>+DB: 12. UPDATE tasks SET status='running' WHERE id=taskId
        DB-->>-Worker: 13. Acknowledges update
        
        Worker->>Worker: 14. Begins processTask(task)
        
        loop For each stage in the task's pipeline
            Worker->>Worker: 15. Spawns child process (e.g., git clone)
            
            note over Worker, Realtime_Server: Worker captures stdout/stderr and forwards it.
            Worker->>+Realtime_Server: 16. Emits 'agent-log' event (taskId, log_chunk)
            Realtime_Server->>Realtime_Server: 17. Looks up clients in room 'taskId'
            Realtime_Server-->>-Frontend: 18. Broadcasts 'agent-log' (log_chunk) to room
            
            Frontend->>+User: 19. Renders new log line in terminal view
        end
    end

    %% 4. Task Completion
    box LightPink "Phase 4: Task Completion"
        Worker->>+DB: 20. UPDATE tasks SET status='completed' WHERE id=taskId
        DB-->>-Worker: 21. Acknowledges update

        Worker->>+Realtime_Server: 22. Emits 'notification' event (taskId, 'Task Completed!')
        Realtime_Server-->>-Frontend: 23. Broadcasts 'notification' ('Task Completed!')
        Frontend-->>-User: 24. Displays success notification toast
    end

```

***

### Exhaustive Step-by-Step Description

Here is a detailed narrative explaining each step in the sequence diagram.

#### Phase 1: Task Creation & Enqueueing

This phase covers the synchronous actions of creating the task and getting it into the system's queue.

1.  **User -> Frontend (Clicks 'Create Task'):** The process starts with a user action. The user, having filled out all required information in the task creation form, clicks the submit button.
2.  **Frontend -> API Server (POST /api/tasks):** The React application bundles the form data into a JSON object. It then makes an asynchronous `fetch` call, sending a `POST` request to the `/api/tasks` endpoint on the Node.js API Server.
3.  **API Server -> Database (INSERT INTO tasks):** The API Server receives the request. Its router calls the appropriate controller logic, which validates the incoming data. It then calls a function in the Data Access Layer (`db.js`), which constructs and executes an `INSERT` SQL statement. The new task is written to the `tasks` table with its `status` explicitly set to `"queued"`.
4.  **Database -> API Server (Returns Record):** The database confirms the write operation and returns the newly created record, including its unique ID, to the API Server.
5.  **API Server -> Frontend (201 Created):** The API Server sends a `201 Created` HTTP response back to the frontend. The body of this response contains the full JSON object of the newly created task. This immediate response is crucial for UI responsiveness; the user is not blocked waiting for the task to actually *run*.
6.  **Frontend -> User (Navigates to Page):** The frontend receives the successful response. It uses the `taskId` from the response body to programmatically navigate the user to the detail page for that new task (e.g., `/tasks/xyz-123`).

#### Phase 2: Real-time Log Subscription

Now that the user is on the task detail page, the frontend needs to subscribe to live updates.

7.  **Frontend -> Real-time Server (Establishes WebSocket Connection):** The `TaskDetail` React component mounts. A `useEffect` hook within its `useTerminalSocket` custom hook initiates a WebSocket connection to the Python Real-time Server.
8.  **Real-time Server -> Frontend (Connection Acknowledged):** The Python server acknowledges the connection.
9.  **Frontend -> Real-time Server (Emits 'join-task'):** Once connected, the frontend's socket client immediately emits a `join-task` event. The payload of this event is an object containing the `taskId` that it retrieved from the URL. This tells the server which specific stream of events this client is interested in. The server then places this client's socket into a conceptual "room" named after the `taskId`.

#### Phase 3: Worker Dequeueing and Execution

This phase happens asynchronously and is entirely driven by the backend.

10. **Worker -> Database (Polls for work):** In a separate process, the Node.js Task Worker is running a continuous loop. In each iteration, it queries the database for any tasks that have the status `"queued"`.
11. **Database -> Worker (Returns queued task):** The database finds the task that was just created in Phase 1 and returns its record to the Worker.
12. **Worker -> Database (UPDATE status='running'):** This is a critical atomic step. The Worker immediately "claims" the task by sending an `UPDATE` command to the database, changing the task's status from `"queued"` to `"running"`. This prevents any other worker processes from accidentally picking up and running the same task.
13. **Database -> Worker (Acknowledges update):** The database confirms the update. The task is now officially owned by this worker instance.
14. **Worker (Begins `processTask`):** The main orchestration logic begins. The worker calls its internal `processTask` function, which reads the task's associated pipeline definition to determine the steps to execute.
15. **Worker (Spawns child process):** For the first stage in the pipeline (e.g., "Clone Repository"), the worker spawns a child process to execute the necessary shell command (e.g., `git clone ...`).
16. **Worker -> Real-time Server (Emits 'agent-log'):** The worker captures the `stdout` and `stderr` streams from the child process. As data chunks are received, the worker emits an `agent-log` event to the Python Real-time Server. The event payload includes the `taskId` and the log data itself. **This is the crucial link:** the Node.js worker acts as a *client* to the Python server to forward logs.
17. **Real-time Server (Looks up clients):** The Python server receives the `agent-log` event. It identifies the `taskId` from the payload.
18. **Real-time Server -> Frontend (Broadcasts 'agent-log'):** The server broadcasts the log data to *every client* that has joined the room for that specific `taskId`.
19. **Frontend -> User (Renders log line):** The user's browser, which is in that room, receives the broadcasted event. The React application appends the log data to the view (e.g., the Xterm.js terminal), allowing the user to see the output in real-time. Steps 15-19 repeat for every log line and every stage in the pipeline.

#### Phase 4: Task Completion

Once all pipeline stages are complete, the task is finalized.

20. **Worker -> Database (UPDATE status='completed'):** After the final stage of the pipeline finishes successfully, the `processTask` function completes. The worker's final action is to send one last `UPDATE` command to the database, setting the task's status to `"completed"`.
21. **Database -> Worker (Acknowledges update):** The database confirms the final status update.
22. **Worker -> Real-time Server (Emits 'notification'):** The worker may optionally send a final, high-level `notification` event to the Real-time Server to signal completion.
23. **Real-time Server -> Frontend (Broadcasts 'notification'):** The Real-time Server broadcasts this notification to all clients in the task's room (or globally).
24. **Frontend -> User (Displays notification):** The frontend receives the notification and might display a success message, a toast, or update the UI to show the final "Completed" status. The flow is now complete.
