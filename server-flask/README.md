# server-flask (Flask + Flask-SocketIO terminal)

## Install
```bash
cd server-flask
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run
```bash
export SOCKET_PORT=5000
python app.py
```

Or:
```bash
./run.sh
```

## Socket.IO protocol
Frontend emits:
- `terminal-command` (xterm input)

Backend emits:
- `terminal-output` (streamed PTY output)
- `terminal-connected` (session info)

