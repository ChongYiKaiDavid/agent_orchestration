# TODO - Jira Issue intake implementation

- [ ] Inspect `agent_orchestration/server/routes.js` to locate best insertion point for new Jira endpoint.
- [ ] Implement `POST /tasks/from-jira` endpoint mapping Jira payload → internal Task payload (title/description/pipeline/repo/targetBranch/priority).
- [ ] Add basic validation + response codes.
- [x] Run unit/lint checks (npm test / npm run lint if available) and/or quick server smoke test.


