import { loadEnv } from '../load_env.js';

// Load environment variables from .env.agent_orchestration if present.
// This is intentionally dependency-free (no dotenv).
loadEnv(process.env.AGENT_ENV_FILE_PATH || '.env.agent_orchestration');
