import { spawn } from "node:child_process";

const port = process.env.PORT ?? "3000";
const nextBin =
  process.platform === "win32"
    ? "node_modules\\.bin\\next.exe"
    : "node_modules/.bin/next";

const child = spawn(nextBin, ["start", "-p", port], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_ENV: "production",
    PORT: port,
    APP_BASE_URL: process.env.APP_BASE_URL ?? "http://127.0.0.1:3000",
    ALLOW_INSECURE_APP_BASE_URL: "true",
  },
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error("Failed to start standalone server:", error.message);
  process.exit(1);
});
