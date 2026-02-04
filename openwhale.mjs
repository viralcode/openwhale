#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

// Run the main entry point
const child = spawn(
    "node",
    ["--enable-source-maps", join(__dirname, "dist/index.js"), ...args],
    {
        stdio: "inherit",
        env: process.env,
    }
);

child.on("exit", (code) => {
    process.exit(code ?? 0);
});
