import type { FullConfig } from "@playwright/test";

/**
 * Fail fast with a helpful message if the app under test is not reachable.
 * The chess app runs via `docker compose up` and serves on http://localhost:8095.
 */
async function globalSetup(_config: FullConfig): Promise<void> {
  const baseURL = process.env.BASE_URL || "http://localhost:8095";
  try {
    const res = await fetch(`${baseURL}/api/classics`);
    if (!res.ok) {
      throw new Error(`GET ${baseURL}/api/classics returned ${res.status}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `\n\nThe app under test is not reachable at ${baseURL}.\n` +
        `Start the stack first:  docker compose up -d --build game-web\n` +
        `Or set BASE_URL to point at a running instance.\n` +
        `Original error: ${msg}\n`,
    );
  }
}

export default globalSetup;
