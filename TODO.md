# TODO

## Implement pipeline/repo reliability improvements (in order)

- [x] Fail fast in `server/engine.js` when a task has no `repository` but the chosen pipeline includes a stage that requires it (e.g. `coding`).
- [x] Propagate `repository` + `targetBranch` from decompose input into created subtasks (`POST /tasks/decompose`).
- [x] Add loud warning/log at worker startup when `FLASK_SOCKET_URL` is unset (log streaming disabled).
- [ ] Run quick smoke checks (server starts, worker can claim task without immediate silent skips).


