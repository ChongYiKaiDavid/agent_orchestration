import os
import uuid
import subprocess
from threading import Thread

try:
    import pty
    import select
    HAS_PTY = True
except ImportError:
    HAS_PTY = False

from flask import Flask, request
from flask_socketio import SocketIO, emit


app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("SECRET_KEY", "dev")

# Use threading for SocketIO
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="gevent")


# Active terminals: session_id -> PTY/process handles
TERMINALS = {}


# ──────────────────────────────────────────────────────────────────────────────
# Agent log streaming
# ──────────────────────────────────────────────────────────────────────────────

@socketio.on("agent-log")
def on_agent_log(data):
    """Receive agent stdout/stderr chunks from the Node.js server and relay them.

    Expected payload shape:
        {
          "taskId":  "uuid-of-task",
          "stageId": "planning|coding|reviewing",
          "type":    "stdout" | "stderr" | "system",
          "data":    "log message string",
          "end":     false
        }

    Each client joins room = taskId before receiving logs.
    We emit to room=taskId so only sockets in that room receive the event.
    """
    task_id = data.get("taskId") or request.sid
    stage_id = data.get("stageId", "")
    log_type = data.get("type", "stdout")
    chunk = data.get("data", "")
    is_end = data.get("end", False)

    prefix = {
        "stdout": "",
        "stderr": "\x1b[31m",
        "system": "\x1b[33m",
    }.get(log_type, "")

    suffix = "\x1b[0m" if prefix else ""

    formatted = f"\x1b[36m[{stage_id}]\x1b[0m {prefix}{chunk}{suffix}"

    # Emit to the taskId room so only clients tracking this task receive logs.
    # If taskId is the Flask sid (PTY mode), emit globally.
    emit_target = task_id if task_id != request.sid else None
    if emit_target:
        print(f"[DEBUG] agent-log -> room {emit_target}")
        socketio.emit("agent-log", {
            "taskId": task_id,
            "stageId": stage_id,
            "type": log_type,
            "data": formatted,
            "end": is_end,
        }, room=emit_target)
    else:
        print(f"[DEBUG] agent-log -> global (sid fallback)")
        socketio.emit("agent-log", {
            "taskId": task_id,
            "stageId": stage_id,
            "type": log_type,
            "data": formatted,
            "end": is_end,
        })


@socketio.on("join-task")
def on_join_task(data):
    """Client requests to join a task room for log delivery."""
    task_id = data.get("taskId")
    if task_id:
        # Client should join the task room so they receive broadcasts for that task.
        socketio.server.enter_room(request.sid, task_id)
        print(f"[DEBUG] join-task: socket {request.sid} joined room {task_id}")
    emit("joined-task", {"taskId": task_id})



def _spawn_shell():
    """Spawn an interactive shell in a PTY."""
    if not HAS_PTY:
        raise Exception("Interactive terminal (PTY) is not supported on Windows. Logs will still stream.")

    shell = os.environ.get("SHELL") or "/bin/bash"
    master_fd, slave_fd = pty.openpty()

    proc = subprocess.Popen(
        [shell],
        stdin=slave_fd,
        stdout=slave_fd,
        stderr=slave_fd,
        close_fds=True,
    )

    # We should close slave on our side; PTY master stays open.
    os.close(slave_fd)
    return master_fd, proc


def _pty_reader(session_id: str):
    master_fd, proc = TERMINALS[session_id]["pty"]

    try:
        while True:
            # If process died, stop
            poll = proc.poll()
            if poll is not None:
                break

            try:
                rlist, _, _ = select.select([master_fd], [], [], 0.1)
            except OSError:
                break
            if not rlist:
                continue

            try:
                data = os.read(master_fd, 4096)
            except OSError:
                break

            if not data:
                continue

            # terminal-output expects string chunks
            socketio.emit("terminal-output", data.decode("utf-8", errors="replace"), room=session_id)
    finally:
        # Cleanup
        try:
            os.close(master_fd)
        except Exception:
            pass
        try:
            TERMINALS.pop(session_id, None)
        except Exception:
            pass


@socketio.on("connect")
def on_connect():
    # Create a session id per socket connection.
    session_id = str(uuid.uuid4())
    # Put socket into its own room so we can emit per terminal.
    # The room must be known by client; we use a query param if provided.
    # For simplicity, client will just listen globally; we emit to room=session_id.
    # Since xterm client doesn't pass room id, we also emit without room fallback.

    TERMINALS[session_id] = {}
    try:
        master_fd, proc = _spawn_shell()
        TERMINALS[session_id]["pty"] = (master_fd, proc)

        # Store current socket session room mapping using request.sid
        # We'll map sid -> session_id.
        TERMINALS[session_id]["sid"] = request.sid

        # Join the room
        socketio.server.enter_room(request.sid, session_id)

        emit("terminal-connected", {"sessionId": session_id})

        reader = Thread(target=_pty_reader, args=(session_id,), daemon=True)
        TERMINALS[session_id]["reader"] = reader
        reader.start()
    except Exception as e:
        emit("terminal-output", f"Failed to start terminal: {e}\n")


@socketio.on("disconnect")
def on_disconnect():
    sid = request.sid
    # Find the terminal session for this socket
    session_id = None
    for sid_key in list(TERMINALS.keys()):
        if TERMINALS[sid_key].get("sid") == sid:
            session_id = sid_key
            break

    if not session_id:
        return

    try:
        master_fd, proc = TERMINALS[session_id]["pty"]
        try:
            proc.terminate()
        except Exception:
            pass
        try:
            os.close(master_fd)
        except Exception:
            pass
    finally:
        TERMINALS.pop(session_id, None)


@socketio.on("terminal-command")
def on_terminal_command(message):
    """Receive input from xterm and write to PTY."""
    # message is raw character/string from xterm. May include newlines.
    sid = request.sid

    session_id = None
    for sid_key in list(TERMINALS.keys()):
        if TERMINALS[sid_key].get("sid") == sid:
            session_id = sid_key
            break

    if not session_id:
        return

    try:
        master_fd, _proc = TERMINALS[session_id]["pty"]
        if message is None:
            return

        if isinstance(message, dict) and "data" in message:
            text = str(message["data"])
        else:
            text = str(message)

        os.write(master_fd, text.encode("utf-8"))
    except Exception as e:
        socketio.emit("terminal-output", f"Write failed: {e}\n", room=session_id)


@app.route("/test-broadcast/<task_id>")
def test_broadcast(task_id):
    """Test endpoint: emit a test message to a room to verify room-based emit works."""
    test_data = {
        "taskId": task_id,
        "stageId": "test",
        "type": "system",
        "data": f"\x1b[1;33m*** TEST BROADCAST to room {task_id} ***\x1b[0m\r\n",
        "end": True,
    }
    print(f"[TEST] Broadcasting to room {task_id}")
    socketio.emit("agent-log", test_data, room=task_id)
    return f"Test broadcast sent to room {task_id}"


if __name__ == "__main__":
    socketio.run(app, host="0.0.0.0", port=5002, debug=False)

