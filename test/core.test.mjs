import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PAGE_MAX, detectFormat, parseSession, paginate, renderDocument, renderScreen } from "../lib/core.js";

const cli = fileURLToPath(new URL("../bin/chat-card.mjs", import.meta.url));
const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cli, ...args], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (buf) => { stdout += buf; });
    child.stderr.on("data", (buf) => { stderr += buf; });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

function entry(obj) {
  return JSON.stringify(obj);
}

function session(lines) {
  return [
    entry({ type: "title", title: "" }),
    entry({ type: "session", version: 3, id: "s1", cwd: "D:\\demo" }),
    ...lines,
  ].join("\n");
}

test("keeps user and assistant text on the active branch", () => {
  const text = session([
    entry({ type: "model_change", id: "m", parentId: null, model: "viate/grok-4.7" }),
    entry({
      type: "message",
      id: "u",
      parentId: "m",
      timestamp: "2026-11-10T17:56:48.000Z",
      message: { role: "user", attribution: "user", content: [{ type: "text", text: "你好" }] },
    }),
    entry({
      type: "message",
      id: "side",
      parentId: "u",
      timestamp: "2026-11-10T17:57:00.000Z",
      message: { role: "assistant", content: [{ type: "text", text: "岔路" }] },
    }),
    entry({
      type: "message",
      id: "a",
      parentId: "u",
      timestamp: "2026-11-10T17:58:00.000Z",
      message: {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "隐藏" },
          { type: "toolCall", name: "read" },
          { type: "text", text: "正文 **粗**" },
        ],
      },
    }),
    entry({
      type: "message",
      id: "t",
      parentId: "a",
      message: { role: "toolResult", content: [{ type: "text", text: "工具输出" }] },
    }),
    entry({ type: "custom", id: "c", parentId: "t", customType: "tool_execution_start", data: {} }),
  ]);
  const parsed = parseSession(text, "omp");
  assert.equal(parsed.contactName, "Grok");
  assert.deepEqual(parsed.messages.map((m) => m.text), ["你好", "正文 **粗**"]);
  assert.equal(parsed.messages[1].side, "them");
});

test("escapes message text", () => {
  const text = session([
    entry({
      type: "message",
      id: "u",
      parentId: null,
      message: { role: "user", attribution: "user", content: "<script>alert(1)</script>" },
    }),
  ]);
  const html = renderScreen(parseSession(text).messages, { contactName: "助手" });
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("&lt;script&gt;"), true);
});

test("rejects an unknown format", () => {
  assert.throws(() => parseSession("{}", "chatgpt"), /不支持这种会话格式/);
});

function lines(records) {
  return records.map((record) => JSON.stringify(record)).join("\n");
}

test("detects the client from the file", () => {
  assert.equal(detectFormat(session([])), "omp");
  assert.equal(detectFormat(lines([
    { type: "user", uuid: "u", sessionId: "s", message: { role: "user", content: "你好" } },
  ])), "claude");
  assert.equal(detectFormat(lines([
    { type: "session_meta", timestamp: "2026-11-10T00:00:00.000Z", payload: { originator: "codex-tui" } },
  ])), "codex");
  assert.equal(detectFormat(lines([
    { timestamp: 1784278802, params: { update: { sessionUpdate: "user_message_chunk", content: { type: "text", text: "你好" } } } },
  ])), "grok");
  assert.equal(detectFormat("not a session"), null);
});

test("reads a Claude Code transcript and drops tools", () => {
  const parsed = parseSession(lines([
    { type: "user", uuid: "u", parentUuid: null, timestamp: "2026-11-10T08:00:00.000Z", sessionId: "s", message: { role: "user", content: [{ type: "text", text: "你好" }] } },
    { type: "assistant", uuid: "side", parentUuid: "u", message: { role: "assistant", model: "claude-sonnet-4-5", content: [{ type: "text", text: "岔路" }] } },
    { type: "assistant", uuid: "a", parentUuid: "u", timestamp: "2026-11-10T08:00:05.000Z", message: { role: "assistant", model: "claude-sonnet-4-5", content: [{ type: "thinking", thinking: "隐藏" }, { type: "text", text: "收到" }, { type: "tool_use", name: "Read", input: {} }] } },
    { type: "user", uuid: "t", parentUuid: "a", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "x", content: "工具" }] } },
  ]), "auto");
  assert.equal(parsed.format, "claude");
  assert.equal(parsed.contactName, "Claude");
  assert.deepEqual(parsed.messages.map((msg) => msg.text), ["你好", "收到"]);
  assert.equal(parsed.messages[1].side, "them");
});

test("reads a Codex rollout and skips developer context", () => {
  const parsed = parseSession(lines([
    { type: "session_meta", timestamp: "2026-11-10T00:00:00.000Z", payload: { originator: "codex-tui" } },
    { type: "turn_context", timestamp: "2026-11-10T00:00:01.000Z", payload: { model: "gpt-5.4" } },
    { type: "response_item", timestamp: "2026-11-10T00:00:02.000Z", payload: { type: "message", role: "developer", content: [{ type: "input_text", text: "system" }] } },
    { type: "response_item", timestamp: "2026-11-10T00:00:03.000Z", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "<environment_context>cwd</environment_context>" }] } },
    { type: "response_item", timestamp: "2026-11-10T00:00:04.000Z", payload: { type: "message", role: "user", content: [{ type: "input_text", text: "<user_query>你好</user_query>" }] } },
    { type: "response_item", timestamp: "2026-11-10T00:00:05.000Z", payload: { type: "message", role: "assistant", content: [{ type: "output_text", text: "收到" }] } },
    { type: "response_item", timestamp: "2026-11-10T00:00:06.000Z", payload: { type: "function_call", name: "exec_command", arguments: "{}" } },
  ]), "auto");
  assert.equal(parsed.format, "codex");
  assert.equal(parsed.contactName, "GPT");
  assert.deepEqual(parsed.messages.map((msg) => [msg.side, msg.text]), [["me", "你好"], ["them", "收到"]]);
});

test("joins Grok Build message chunks and drops thoughts", () => {
  const parsed = parseSession(lines([
    { timestamp: 1784278802, params: { update: { sessionUpdate: "user_message_chunk", content: { type: "text", text: "你" } }, _meta: { promptIndex: 0 } } },
    { timestamp: 1784278802, params: { update: { sessionUpdate: "user_message_chunk", content: { type: "text", text: "好" } }, _meta: { promptIndex: 0 } } },
    { timestamp: 1784278803, params: { update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "收" } }, _meta: { promptId: "p1" } } },
    { timestamp: 1784278803, params: { update: { sessionUpdate: "agent_thought_chunk", content: { type: "text", text: "隐藏" } }, _meta: { promptId: "p1" } } },
    { timestamp: 1784278804, params: { update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "到" } }, _meta: { promptId: "p1" } } },
  ]), "auto");
  assert.equal(parsed.format, "grok");
  assert.equal(parsed.contactName, "Grok");
  assert.deepEqual(parsed.messages.map((msg) => [msg.side, msg.text]), [["me", "你好"], ["them", "收到"]]);
});

test("pages stay within the canvas budget", () => {
  const text = session([
    entry({
      type: "message",
      id: "u",
      parentId: null,
      timestamp: "2026-11-10T17:56:48.000Z",
      message: { role: "user", attribution: "user", content: "甲".repeat(5000) },
    }),
  ]);
  const pages = paginate(parseSession(text).messages, { layout: "phone" });
  assert.ok(pages.length >= 2);
  for (const page of pages) assert.ok(page.height <= PAGE_MAX, String(page.height));
});

test("cli writes html and mcp lists the tool", async () => {
  const dir = mkdtempSync(join(tmpdir(), "chat-card-"));
  try {
    const src = join(dir, "s.jsonl");
    const out = join(dir, "out.html");
    writeFileSync(src, session([
      entry({
        type: "message",
        id: "u",
        parentId: null,
        timestamp: "2026-11-10T17:56:48.000Z",
        message: { role: "user", attribution: "user", content: "你好" },
      }),
    ]));
    const child = spawn(process.execPath, [cli, "render", src, "-o", out, "--layout", "phone"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    child.stderr.on("data", (buf) => { stderr += buf; });
    const code = await new Promise((resolve) => child.on("close", resolve));
    assert.equal(code, 0, stderr);
    const html = readFileSync(out, "utf8");
    assert.equal(html.includes("你好"), true);
    assert.equal(html.includes("class=\"stage is-pc\""), false);

    const mcp = spawn(process.execPath, [cli, "mcp"], { stdio: ["pipe", "pipe", "pipe"] });
    const frames = [];
    let buf = Buffer.alloc(0);
    mcp.stdout.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      while (true) {
        const headerEnd = buf.indexOf("\r\n\r\n");
        if (headerEnd < 0) return;
        const header = buf.slice(0, headerEnd).toString("utf8");
        const match = /Content-Length:\s*(\d+)/i.exec(header);
        if (!match) {
          buf = buf.slice(headerEnd + 4);
          continue;
        }
        const len = Number(match[1]);
        const start = headerEnd + 4;
        if (buf.length < start + len) return;
        frames.push(JSON.parse(buf.slice(start, start + len).toString("utf8")));
        buf = buf.slice(start + len);
      }
    });
    const send = (obj) => {
      const body = Buffer.from(JSON.stringify(obj));
      mcp.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
      mcp.stdin.write(body);
    };
    send({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2024-11-05" } });
    send({ jsonrpc: "2.0", method: "notifications/initialized" });
    send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    const mcpOut = join(dir, "mcp.html");
    send({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "render_chat", arguments: { path: src, out: mcpOut, layout: "pc" } },
    });
    const got = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`mcp timeout: ${frames.length}`)), 8000);
      const wait = () => {
        if (frames.length >= 3) {
          clearTimeout(timer);
          resolve(frames);
          return;
        }
        setTimeout(wait, 20);
      };
      wait();
    }).finally(() => mcp.kill());
    assert.equal(got[0].id, 1);
    assert.equal(got[0].result.serverInfo.version, pkg.version);
    assert.equal(got[1].result.tools[0].name, "render_chat");
    assert.equal(got[1].result.tools[0].inputSchema.properties.format.enum[0], "omp");
    assert.equal(readFileSync(mcpOut, "utf8").includes("class=\"stage is-pc\""), true);
    const doc = renderDocument({
      contactName: "Grok",
      layout: "phone",
      pages: paginate(parseSession(readFileSync(src, "utf8")).messages, { layout: "phone" }),
    });
    assert.equal(doc.includes("<!DOCTYPE html>"), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("--version prints the package version", async () => {
  const result = await runCli(["--version"]);
  assert.equal(result.code, 0);
  assert.equal(result.stdout, `chat-card ${pkg.version}\n`);
});

test("missing option value exits non-zero", async () => {
  const result = await runCli(["--layout"]);
  assert.notEqual(result.code, 0);
});

test("option value cannot be another flag", async () => {
  const result = await runCli(["--layout", "--help"]);
  assert.notEqual(result.code, 0);
  assert.equal(result.stdout, "");
});

test("unknown flag exits non-zero", async () => {
  const example = fileURLToPath(new URL("../examples/omp-session.jsonl", import.meta.url));
  const result = await runCli(["render", example, "--not-a-flag"]);
  assert.notEqual(result.code, 0);
});

test("renders examples/omp-session.jsonl", async () => {
  const dir = mkdtempSync(join(tmpdir(), "chat-card-example-"));
  try {
    const example = fileURLToPath(new URL("../examples/omp-session.jsonl", import.meta.url));
    const out = join(dir, "out.html");
    const result = await runCli(["render", example, "-o", out]);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(readFileSync(out, "utf8").includes("你好"), true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("readme points at the public github package", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.equal(readme.includes("你的名字"), false);
  assert.equal(/\b[A-Za-z]:[\\/]/.test(readme), false);
  assert.equal(readme.includes("github:AchanYao/chat-card"), true);
});
