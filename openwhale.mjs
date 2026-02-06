#!/usr/bin/env node
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

// Determine which entry point to use based on command
// If no args or 'serve'/'server' command, run the server
// Otherwise run the CLI
const serverCommands = ["serve", "server"];
const isServerCommand = args.length === 0 || serverCommands.includes(args[0]);

const entryPoint = isServerCommand
    ? join(__dirname, "dist/index.js")
    : join(__dirname, "dist/cli.js");

// For development, use tsx if dist doesn't exist
const srcEntry = isServerCommand
    ? join(__dirname, "src/index.ts")
    : join(__dirname, "src/cli.ts");

import { existsSync } from "node:fs";

const useSource = !existsSync(entryPoint);
const finalEntry = useSource ? srcEntry : entryPoint;
const runner = useSource ? "tsx" : "node";
const nodeArgs = useSource ? [] : ["--enable-source-maps"];

const child = spawn(
    runner,
    [...nodeArgs, finalEntry, ...args],
    {
        stdio: "inherit",
        env: process.env,
    }
);

child.on("exit", (code) => {
    process.exit(code ?? 0);
});
