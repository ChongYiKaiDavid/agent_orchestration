# Application Usage and Explanation Guide

Welcome to the **Agent Orchestration** application! This guide will explain exactly what this project is, how it works behind the scenes, and provide step-by-step instructions on how to use it.

## 1. What is this Project?

This project is an **AI Agent Orchestration System**. Imagine you are a manager, and you have AI "workers" (agents) that can plan code, write code, and review code. 

Instead of manually giving instructions to an AI every single time, this application allows you to create a **Task** (e.g., "Add a new login button"). The application then automatically guides your AI agents through a **Pipeline** of stages, such as:
1. **Planning:** An AI plans out how to implement the feature.
2. **Coding:** An AI writes the code based on the plan.
3. **Reviewing:** An AI reviews the code to ensure it's safe and correct.

### The Three Main Components
To make this magic happen, the application is split into three separate parts that must run at the same time:
1. **The Frontend (UI):** The visual website you interact with to create and monitor tasks (built with React/Vite).
2. **The Backend Server (API):** A server that takes your tasks from the UI and saves them into a local database (SQLite).
3. **The Background Worker:** An automated system that constantly checks the database for new tasks. When it finds one, it claims it, prepares an isolated workspace folder, and runs the AI agent (named "devin") through the pipeline stages.

---

## 2. Step-by-Step: How to Start the Application

Because this project relies on three distinct pieces working together, you must start all three in separate terminal windows.

### Step 1: Install the requirements
Open your terminal in the `agent_orchestration` folder and install all necessary packages:
```bash
npm install
```

### Step 2: Start the Frontend UI (Terminal 1)
In the same terminal window, run:
```bash
npm run dev
```
* **What this does:** It starts the visual dashboard. You can now open your web browser and go to `http://localhost:5173` to see the application. Leave this terminal open.

### Step 3: Start the Backend Server (Terminal 2)
Open a **new, second terminal window** in the `agent_orchestration` folder and run:
```bash
npm run server
```
* **What this does:** It starts the background API server. Without this, your frontend cannot save tasks to the database. Leave this terminal open.

### Step 4: Start the Background Worker (Terminal 3)
Open a **new, third terminal window** in the `agent_orchestration` folder and run:
```bash
npm run worker
```
* **What this does:** It starts the background worker. It will immediately begin looking for queued tasks in the database and executing them.

---

## 3. Step-by-Step: How to Use the UI

Now that everything is running, open your web browser and navigate to `http://localhost:5173`.

### Step 1: Create a Task
1. Look at the left sidebar menu and click on **Create Task**.
2. **Title:** Give your task a name (e.g., "Update Homepage UI").
3. **Description:** Briefly describe what needs to be done.
4. **Pipeline:** You can choose the workflow you want the AI to follow. E.g., `Plan → Code → Review` means the AI will go through three separate stages.
5. **Repository URL (Optional):** If you want the AI to work on real code, you paste a public Git URL here (e.g., `https://github.com/facebook/react.git`). If you just want to test the system, **leave this blank**.
6. **Submit:** Click the "Create & Queue" button. 

* **What happens behind the scenes:** The UI sends your task to the Backend Server (Terminal 2), which saves it in the database with a status of `"queued"`.

### Step 2: Watch the Magic Happen
1. Go back to the **Dashboard** or **Recent Tasks** page using the sidebar.
2. You will see your task there. Its status will quickly change from `queued` ➔ `running`.
3. If you look at **Terminal 3 (The Worker)**, you will see text logging out that the worker has "claimed" your task and is running the pipeline stages.

### Step 3: Understand the Results
Once the task finishes, its status will change to `completed`.
But where did the AI do its work?

1. Open your computer's file explorer.
2. Navigate to `agent_orchestration/server/workspaces/`.
3. You will see a folder with a unique ID matching your task.
4. Inside that folder, you will see sub-folders for each pipeline stage (e.g., `planning`, `coding`, `reviewing`).
5. Inside those folders, you will find a `prompt.txt` (the instructions given to the AI) and an `output.txt` (the simulated answer from the AI). 

If you had provided a real Repository URL in Step 1, the AI's changes would have been applied directly to a cloned version of that code inside this workspace folder.

---

## Summary for Explaining to Others

If you need to explain this project to someone else, you can summarize it like this:

> "This is an orchestration dashboard for AI coding agents. I can go to the web interface and define a coding task. A backend server receives that task and puts it in a queue. A separate background worker constantly watches that queue, picks up the task, generates an isolated file workspace, and passes instructions to an AI agent to plan, code, and review the changes safely without breaking our main codebase."
