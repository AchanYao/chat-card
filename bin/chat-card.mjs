#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { stdin, stdout, stderr } from "node:process";
import { resolve } from "node:path";
import { parseSession, paginate, renderDocument, DEFAULT_ME, DEFAULT_THEM, FORMATS } from "../lib/core.js";

const VERSION = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;

const HELP = `chat-card — omp/pi 会话转微信式 HTML

  chat-card render <session.jsonl> [-o out.html]
      [--layout phone|pc|auto] [--format omp|claude|codex|grok|auto] [--name 昵称]
      [--avatar-me 图片] [--avatar-them 图片]
  node bin/chat-card.mjs render <session.jsonl> [选项同上]
  chat-card mcp
  node bin/chat-card.mjs mcp
  chat-card --version
  node bin/chat-card.mjs --version

--layout phone|pc|auto  默认 auto。auto 按手机宽度分页，宽窗口只改变外观。
--format 格式            omp、claude、codex、grok 或 auto。默认 omp。auto 按文件识别。
--name 昵称             顶栏昵称。
-o, --out 文件          输出 HTML 路径。
--avatar-me 图片        我的头像。
--avatar-them 图片      对方头像。
-V, --version           打印版本后退出。
-h, --help              打印帮助后退出。

文件只在本机读写。
`;

function requireValue(argv, index, flag) {
  const value = argv[index + 1];
  if (value == null || value.startsWith("-")) throw new Error(`${flag} 需要参数`);
  return value;
}

function parseArgs(argv) {
  const out = {
    _: [],
    layout: "auto",
    format: "omp",
    name: "",
    outPath: "",
    avatarMe: "",
    avatarThem: "",
    help: false,
    version: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--layout") {
      out.layout = requireValue(argv, i, arg);
      i++;
    } else if (arg === "--format") {
      out.format = requireValue(argv, i, arg);
      i++;
    } else if (arg === "--name") {
      out.name = requireValue(argv, i, arg);
      i++;
    } else if (arg === "-o" || arg === "--out") {
      out.outPath = requireValue(argv, i, arg);
      i++;
    } else if (arg === "--avatar-me") {
      out.avatarMe = requireValue(argv, i, arg);
      i++;
    } else if (arg === "--avatar-them") {
      out.avatarThem = requireValue(argv, i, arg);
      i++;
    } else if (arg === "-h" || arg === "--help") out.help = true;
    else if (arg === "-V" || arg === "--version") out.version = true;
    else if (arg.startsWith("-")) throw new Error(`未知参数 ${arg}`);
    else out._.push(arg);
  }
  return out;
}

function dataUrl(path) {
  const buf = readFileSync(path);
  const ext = path.split(".").pop().toLowerCase();
  const mime = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    svg: "image/svg+xml",
  }[ext] || "application/octet-stream";
  return `data:${mime};base64,${buf.toString("base64")}`;
}

function renderFile(flags) {
  const input = flags._[1];
  if (!input) throw new Error("缺少 session jsonl 路径");
  if (!["phone", "pc", "auto"].includes(flags.layout)) throw new Error("--layout 只能是 phone、pc 或 auto");
  const session = parseSession(readFileSync(input, "utf8"), flags.format);
  const pageLayout = flags.layout === "pc" ? "pc" : "phone";
  const pages = paginate(session.messages, { layout: pageLayout });
  const dest = resolve(flags.outPath || input.replace(/\.jsonl?$/i, "") + ".wechat.html");
  const html = renderDocument({
    contactName: flags.name || session.contactName,
    pages,
    layout: flags.layout,
    avatars: {
      me: flags.avatarMe ? dataUrl(flags.avatarMe) : DEFAULT_ME,
      them: flags.avatarThem ? dataUrl(flags.avatarThem) : DEFAULT_THEM,
    },
  });
  writeFileSync(dest, html);
  return { dest, pages: pages.length, messages: session.messages.length, contactName: flags.name || session.contactName };
}

function send(msg) {
  const body = Buffer.from(JSON.stringify(msg));
  stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  stdout.write(body);
}

const TOOL = {
  name: "render_chat",
  description: "把本机的 omp/pi session JSONL 渲染成微信式 HTML。不上传文件。返回输出路径和页数。",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "session .jsonl 路径" },
      format: { type: "string", enum: [...FORMATS.map((item) => item.id), "auto"], description: "omp、claude、codex、grok 或 auto。省略时按 omp" },
      layout: { type: "string", enum: ["phone", "pc", "auto"] },
      name: { type: "string", description: "顶栏昵称" },
      out: { type: "string", description: "输出 HTML 路径" },
      avatarMe: { type: "string", description: "我的头像图片路径" },
      avatarThem: { type: "string", description: "对方头像图片路径" },
    },
    required: ["path"],
  },
};

function handle(msg) {
  if (!msg || msg.jsonrpc !== "2.0" || (msg.id == null && String(msg.method || "").startsWith("notifications/"))) return;
  const fail = (code, message) => send({ jsonrpc: "2.0", id: msg.id, error: { code, message } });
  try {
    if (msg.method === "initialize") {
      send({
        jsonrpc: "2.0",
        id: msg.id,
        result: {
          protocolVersion: msg.params?.protocolVersion || "2024-11-05",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "chat-card", version: VERSION },
        },
      });
      return;
    }
    if (msg.method === "tools/list") {
      send({ jsonrpc: "2.0", id: msg.id, result: { tools: [TOOL] } });
      return;
    }
    if (msg.method === "ping") {
      send({ jsonrpc: "2.0", id: msg.id, result: {} });
      return;
    }
    if (msg.method === "tools/call") {
      const name = msg.params?.name;
      const args = msg.params?.arguments || {};
      if (name !== "render_chat") return fail(-32602, `未知工具 ${name}`);
      if (!args.path) return fail(-32602, "缺少 path");
      try {
        const result = renderFile({
          _: ["render", args.path],
          layout: args.layout || "auto",
          format: args.format || "omp",
          name: args.name || "",
          outPath: args.out || "",
          avatarMe: args.avatarMe || "",
          avatarThem: args.avatarThem || "",
        });
        send({
          jsonrpc: "2.0",
          id: msg.id,
          result: {
            content: [{
              type: "text",
              text: `${result.contactName}: messages=${result.messages} pages=${result.pages} -> ${result.dest}`,
            }],
          },
        });
      } catch (err) {
        send({
          jsonrpc: "2.0",
          id: msg.id,
          result: { content: [{ type: "text", text: err.message }], isError: true },
        });
      }
      return;
    }
    if (msg.id != null) fail(-32601, `未知方法 ${msg.method}`);
  } catch (err) {
    if (msg.id != null) fail(-32603, err.message);
  }
}

function serveMcp() {
  let buf = Buffer.alloc(0);
  stdin.on("data", (chunk) => {
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
      const body = buf.slice(start, start + len).toString("utf8");
      buf = buf.slice(start + len);
      try {
        handle(JSON.parse(body));
      } catch (err) {
        stderr.write(`${err.message}\n`);
      }
    }
  });
  stdin.resume();
}

function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.version) {
    stdout.write(`chat-card ${VERSION}\n`);
    return;
  }
  if (flags.help || !flags._.length) {
    stdout.write(HELP);
    return;
  }
  if (flags._[0] === "mcp") {
    serveMcp();
    return;
  }
  if (flags._[0] !== "render") throw new Error("子命令只能是 render 或 mcp");
  const result = renderFile(flags);
  stdout.write(`${result.contactName}: messages=${result.messages} pages=${result.pages} -> ${result.dest}\n`);
}

try {
  main();
} catch (err) {
  stderr.write(`${err.message}\n`);
  process.exitCode = 1;
}
