#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

export PYTHONUNBUFFERED=1

# Use eventlet (required by flask-socketio async_mode)
# and make sure it uses the right interpreter.
python -m pip install -r requirements.txt

export SOCKET_PORT=${SOCKET_PORT:-5000}

python app.py

