#!/usr/bin/env node
// mcp/index.ts

import * as github from "./tools/github";
import { createInterface } from "readline";

const args = process.argv.slice(2);

// ✅ CLI args → 환경변수 주입
for (const arg of args) {
  const [key, value] = arg.split("=");
  if (key && value) process.env[key] = value;
}

// ✅ MCP 요청 처리
const rl = createInterface({ input: process.stdin, output: process.stdout });

rl.on("line", async (line) => {
  try {
    const { method, params } = JSON.parse(line);

    let result = null;

    if (method === "github/findOrCreatePr") {
      result = await github.findOrCreatePr(params);
    }

    process.stdout.write(JSON.stringify({ result }) + "\n");
  } catch (err: any) {
    console.error("[MCP Error]", err);
    process.stderr.write(JSON.stringify({ error: err.message }) + "\n");
  }
});
