import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/** Reset the database to the seed data so every run starts from the same state. */
export default function globalSetup() {
  const backend = fileURLToPath(new URL("../backend", import.meta.url));
  execSync("uv run python -m app.seed --reset", { cwd: backend, stdio: "inherit" });
}
