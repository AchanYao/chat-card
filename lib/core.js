// Parse omp/pi session JSONL and render WeChat-style HTML. No DOM.

export const PAGE_MAX = 4000;
export const FORMATS = [{ id: "omp", label: "omp / pi" }];

const METRICS = {
  phone: {
    header: 49,
    mainPad: 42,
    contentWidth: 268,
    font: 16,
    line: 26,
    paraGap: 10,
    rowGap: 16,
    bubblePad: 22,
    time: 36,
    codeLine: 20,
    codeCaption: 22,
  },
  pc: {
    header: 65,
    mainPad: 60,
    contentWidth: 836,
    font: 14,
    line: 26,
    paraGap: 10,
    rowGap: 18,
    bubblePad: 22,
    time: 36,
    codeLine: 20,
    codeCaption: 22,
  },
};

function svg(body) {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">${body}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(doc)}`;
}

export const PRESETS = [
  {
    id: "g",
    label: "G",
    url: svg(`<rect width="40" height="40" fill="#111"/><text x="20" y="27" text-anchor="middle" font-family="Georgia,serif" font-size="22" fill="#fff">G</text>`),
  },
  {
    id: "ink",
    label: "墨",
    url: svg(`<rect width="40" height="40" fill="#3f3f46"/><circle cx="20" cy="20" r="7" fill="none" stroke="#fff" stroke-width="2"/>`),
  },
  {
    id: "green",
    label: "绿",
    url: svg(`<rect width="40" height="40" fill="#1f8a4c"/><text x="20" y="27" text-anchor="middle" font-family="Georgia,serif" font-size="20" fill="#fff">A</text>`),
  },
  {
    id: "blue",
    label: "蓝",
    url: svg(`<rect width="40" height="40" fill="#2563eb"/><text x="20" y="27" text-anchor="middle" font-family="Georgia,serif" font-size="20" fill="#fff">C</text>`),
  },
];

export const DEFAULT_THEM = PRESETS[0].url;
export const DEFAULT_ME = svg(
  `<rect width="40" height="40" fill="#3a3a3a"/><circle cx="20" cy="15" r="6" fill="#fff"/><path d="M8 34c1.5-7 6-10 12-10s10.5 3 12 10" fill="#fff"/>`,
);

export const CHAT_CSS = `
.stage { color: #111; font-family: "PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif; }
.stage:not(.is-pc) { background: #ededed; }
.sheet { display: flex; justify-content: center; }
.screen { width: min(420px, 100%); margin: 0 auto; background: #ededed; }
.screen header {
  height: 48px; display: flex; align-items: center; justify-content: space-between;
  padding: 0 12px; background: #ededed; border-bottom: 1px solid #d6d6d6;
}
.back, .more { width: 28px; font-size: 22px; line-height: 1; color: #111; }
.more { text-align: right; letter-spacing: 1px; font-size: 18px; }
.head-av { display: none; }
.who { font-size: 17px; font-weight: 600; }
.screen main { padding: 14px 12px 28px; }
.time { text-align: center; color: #b2b2b2; font-size: 12px; margin: 6px 0 14px; }
.row { display: flex; align-items: flex-start; gap: 8px; margin: 0 0 16px; }
.row.me { flex-direction: row-reverse; }
.av {
  width: 40px; height: 40px; border-radius: 4px; flex: none;
  background: #ddd center/cover no-repeat;
}
.bubble {
  max-width: min(292px, calc(100% - 56px));
  padding: 9px 12px; border-radius: 4px; font-size: 16px; line-height: 1.5;
  position: relative; overflow-wrap: anywhere;
}
.row.them .bubble { background: #fff; }
.row.me .bubble { background: #95ec69; }
.row.them .bubble:before, .row.me .bubble:after {
  content: ""; position: absolute; top: 14px; border: 6px solid transparent;
}
.row.them .bubble:before { left: -6px; border-right-color: #fff; border-left: 0; }
.row.me .bubble:after { right: -6px; border-left-color: #95ec69; border-right: 0; }
.bubble p { margin: 0 0 8px; }
.bubble p:last-child, .bubble ul:last-child, .bubble ol:last-child, .bubble figure:last-child { margin-bottom: 0; }
.bubble p.h { font-weight: 650; }
.bubble ul, .bubble ol { margin: 0 0 8px; padding-left: 1.15em; }
.bubble li { margin: 0 0 4px; }
.bubble code {
  font-family: Consolas, "Sarasa Mono SC", monospace; font-size: 0.86em;
  background: rgba(0,0,0,.06); border-radius: 3px; padding: 0 3px;
}
figure.code { margin: 8px 0; background: rgba(0,0,0,.05); border-radius: 4px; overflow: hidden; }
figure.code figcaption {
  display: flex; justify-content: space-between; gap: 8px;
  padding: 4px 8px 0; font-size: 11px; color: #888;
}
figure.code pre {
  margin: 0; padding: 6px 8px 8px;
  font-family: Consolas, "Sarasa Mono SC", monospace;
  font-size: 12px; line-height: 1.45; white-space: pre-wrap; overflow-wrap: anywhere;
}
.stage.is-pc { background: #e6e6e6; }
.stage.is-pc .screen {
  width: 100%; max-width: 1080px; background: #f5f5f5; box-shadow: 0 0 0 1px #ddd;
}
.stage.is-pc .screen header {
  height: 64px; padding: 0 22px; gap: 12px; justify-content: flex-start;
  background: #f5f5f5; border-bottom: 1px solid #e7e7e7;
}
.stage.is-pc .back { display: none; }
.stage.is-pc .head-av { display: block; width: 36px; height: 36px; }
.stage.is-pc .who { font-size: 18px; }
.stage.is-pc .more { margin-left: auto; width: auto; font-size: 20px; }
.stage.is-pc .screen main { padding: 20px 28px 40px; }
.stage.is-pc .row { gap: 10px; margin-bottom: 18px; }
.stage.is-pc .av { width: 36px; height: 36px; }
.stage.is-pc .bubble {
  max-width: min(860px, calc(100% - 92px));
  font-size: 14px; line-height: 1.65;
}
.stage.is-pc figure.code pre { white-space: pre-wrap; overflow-wrap: anywhere; font-size: 13px; }
`.trim();

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function cssUrl(url) {
  return `url('${String(url).replace(/'/g, "%27")}')`;
}

function metricsFor(layout, contentWidth) {
  const base = METRICS[layout === "pc" ? "pc" : "phone"];
  if (!contentWidth) return base;
  return { ...base, contentWidth };
}

function cst(ms) {
  const d = new Date(ms + 8 * 3600 * 1000);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    h: d.getUTCHours(),
    min: d.getUTCMinutes(),
  };
}

function clock(ms) {
  const p = cst(ms);
  let label;
  let h;
  if (p.h < 6) {
    label = "凌晨";
    h = p.h === 0 ? 12 : p.h;
  } else if (p.h < 12) {
    label = "上午";
    h = p.h;
  } else if (p.h < 13) {
    label = "中午";
    h = p.h;
  } else if (p.h < 18) {
    label = "下午";
    h = p.h - 12;
  } else {
    label = "晚上";
    h = p.h - 12;
  }
  return `${label}${h}:${String(p.min).padStart(2, "0")}`;
}

function formatGap(at, prev) {
  if (at == null) return null;
  const a = cst(at);
  if (prev == null) return `${a.m}月${a.day}日 ${clock(at)}`;
  const p = cst(prev);
  const sameDay = a.y === p.y && a.m === p.m && a.day === p.day;
  if (!sameDay || at - prev >= 5 * 60 * 1000) {
    return `${sameDay ? "" : `${a.m}月${a.day}日 `}${clock(at)}`;
  }
  return null;
}

function extractFences(text) {
  const slots = [];
  const replaced = text.replace(/```([^\n`]*)\n([\s\S]*?)```/g, (_, info, body) => {
    const key = `\u0000S${slots.length}\u0000`;
    slots.push({ info, body });
    return `\n${key}\n`;
  });
  return { replaced, slots };
}

function inline(raw) {
  const parts = String(raw).split(/`([^`]+)`/);
  let out = "";
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) out += `<code>${esc(parts[i])}</code>`;
    else out += esc(parts[i]).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  }
  return out;
}

function isSpecial(line) {
  return /^(#{1,6}\s+|[-*]\s+|\d+\.\s+)/.test(line) || /^\u0000S\d+\u0000$/.test(line.trim());
}

function citeCaption(info) {
  const cite = /^(\d+):(\d+):(.+)$/.exec(info.trim());
  if (cite) {
    const path = cite[3];
    const name = path.replace(/\\/g, "/").split("/").pop();
    return `<figcaption title="${esc(path)}">${esc(name)}<span>${esc(cite[1])}–${esc(cite[2])}</span></figcaption>`;
  }
  if (info.trim() && (info.includes("/") || info.includes("\\"))) {
    return `<figcaption>${esc(info.trim())}</figcaption>`;
  }
  return "";
}

function renderText(text) {
  const { replaced, slots } = extractFences(text);
  const lines = replaced.replace(/\r\n/g, "\n").split("\n");
  const parts = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const slot = /^\u0000S(\d+)\u0000$/.exec(line.trim());
    if (slot) {
      const { info, body } = slots[Number(slot[1])];
      parts.push(`<figure class="code">${citeCaption(info)}<pre>${esc(body.replace(/\s+$/, ""))}</pre></figure>`);
      i += 1;
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      parts.push(`<p class="h">${inline(heading[2])}</p>`);
      i += 1;
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(inline(lines[i].replace(/^[-*]\s+/, "")));
        i += 1;
      }
      parts.push(`<ul>${items.map((item) => `<li>${item}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(inline(lines[i].replace(/^\d+\.\s+/, "")));
        i += 1;
      }
      parts.push(`<ol>${items.map((item) => `<li>${item}</li>`).join("")}</ol>`);
      continue;
    }
    const para = [line];
    i += 1;
    while (i < lines.length && lines[i].trim() && !isSpecial(lines[i])) {
      para.push(lines[i]);
      i += 1;
    }
    parts.push(`<p>${para.map((x) => inline(x)).join("<br/>")}</p>`);
  }
  return parts.join("");
}

function charsPerLine(metrics) {
  return Math.max(8, Math.floor(metrics.contentWidth / metrics.font));
}

function wrappedLines(text, metrics) {
  const chars = charsPerLine(metrics);
  const n = [...String(text)].length;
  return Math.max(1, Math.ceil(n / chars));
}

function textHeight(text, metrics) {
  const { replaced, slots } = extractFences(String(text));
  const lines = replaced.replace(/\r\n/g, "\n").split("\n");
  let h = 0;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    const slot = /^\u0000S(\d+)\u0000$/.exec(line.trim());
    if (slot) {
      const { info, body } = slots[Number(slot[1])];
      const bodyLines = body.replace(/\s+$/, "").split("\n");
      let codeH = 12;
      if (/^\d+:\d+:.+/.test(info.trim()) || info.includes("/") || info.includes("\\")) codeH += metrics.codeCaption;
      for (const bl of bodyLines) codeH += metrics.codeLine * wrappedLines(bl, metrics);
      h += codeH + metrics.paraGap;
      i += 1;
      continue;
    }
    if (/^#{1,6}\s+/.test(line)) {
      h += metrics.line + metrics.paraGap;
      i += 1;
      continue;
    }
    if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
      const re = /^[-*]\s+/.test(line) ? /^[-*]\s+/ : /^\d+\.\s+/;
      while (i < lines.length && re.test(lines[i])) {
        h += metrics.line * wrappedLines(lines[i].replace(re, ""), metrics);
        i += 1;
      }
      h += metrics.paraGap;
      continue;
    }
    let para = 0;
    while (i < lines.length && lines[i].trim() && !isSpecial(lines[i])) {
      para += wrappedLines(lines[i], metrics);
      i += 1;
    }
    h += para * metrics.line + metrics.paraGap;
  }
  return h;
}

function rowHeight(text, metrics, showTime) {
  return metrics.bubblePad + textHeight(text, metrics) + metrics.rowGap + (showTime ? metrics.time : 0);
}

function splitChunks(text) {
  const lines = String(text).replace(/\r\n/g, "\n").split("\n");
  const chunks = [];
  let cur = [];
  let fence = false;
  const push = () => {
    if (cur.length) chunks.push(cur.join("\n"));
    cur = [];
  };
  for (const line of lines) {
    if (line.startsWith("```")) {
      fence = !fence;
      cur.push(line);
      if (!fence) push();
      continue;
    }
    if (!fence && !line.trim() && cur.length) {
      push();
      continue;
    }
    cur.push(line);
  }
  push();
  return chunks.length ? chunks : [String(text)];
}

function cutLine(line, metrics, limit) {
  const chars = charsPerLine(metrics);
  const maxLines = Math.max(1, Math.floor(limit / metrics.line) - 1);
  const size = Math.max(chars, chars * maxLines);
  const arr = [...line];
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size).join(""));
  return out.length ? out : [line];
}

function hardSplit(chunk, metrics, limit) {
  const fence = chunk.match(/^```([^\n]*)\n([\s\S]*?)\n?```$/);
  if (fence) {
    const info = fence[1];
    const bodyLines = fence[2].split("\n");
    const pieces = [];
    let cur = [];
    const wrap = (ls) => `\`\`\`${info}\n${ls.join("\n")}\n\`\`\``;
    for (const line of bodyLines) {
      const bits = textHeight(line, metrics) > limit ? cutLine(line, metrics, limit) : [line];
      for (const bit of bits) {
        const trial = wrap([...cur, bit]);
        if (cur.length && textHeight(trial, metrics) > limit) {
          pieces.push(wrap(cur));
          cur = [bit];
        } else cur.push(bit);
      }
    }
    if (cur.length) pieces.push(wrap(cur));
    return pieces.length ? pieces : [chunk];
  }
  const lines = chunk.split("\n");
  const pieces = [];
  let cur = [];
  for (const line of lines) {
    const bits = textHeight(line, metrics) > limit ? cutLine(line, metrics, limit) : [line];
    for (const bit of bits) {
      const trial = [...cur, bit].join("\n");
      if (cur.length && textHeight(trial, metrics) > limit) {
        pieces.push(cur.join("\n"));
        cur = [bit];
      } else cur.push(bit);
    }
  }
  if (cur.length) pieces.push(cur.join("\n"));
  return pieces.length ? pieces : [chunk];
}

function fitPieces(text, metrics, budget) {
  const limit = budget - metrics.bubblePad - metrics.rowGap - metrics.time;
  if (textHeight(text, metrics) <= limit) return [text];
  const groups = [];
  let cur = [];
  const flush = () => {
    if (cur.length) groups.push(cur.join("\n\n"));
    cur = [];
  };
  for (const chunk of splitChunks(text)) {
    const bits = textHeight(chunk, metrics) > limit ? hardSplit(chunk, metrics, limit) : [chunk];
    for (const bit of bits) {
      const trial = [...cur, bit].join("\n\n");
      if (cur.length && textHeight(trial, metrics) > limit) flush();
      cur.push(bit);
    }
  }
  flush();
  return groups.length ? groups : [text];
}

export function paginate(messages, opts = {}) {
  const layout = opts.layout === "pc" ? "pc" : "phone";
  const pageMax = opts.pageMax || PAGE_MAX;
  const metrics = metricsFor(layout, opts.contentWidth);
  const budget = pageMax - metrics.header - metrics.mainPad;
  const pages = [];
  let cur = [];
  let used = 0;
  let prevAt = null;
  const flush = () => {
    if (!cur.length) return;
    pages.push({ messages: cur, height: metrics.header + metrics.mainPad + used });
    cur = [];
    used = 0;
  };
  for (const msg of messages) {
    const pieces = fitPieces(msg.text, metrics, budget);
    pieces.forEach((text, index) => {
      const at = msg.at;
      let showTime = cur.length === 0 ? at != null : index === 0 && formatGap(at, prevAt) != null;
      let h = rowHeight(text, metrics, showTime);
      if (cur.length && (h > budget || used + h > budget)) {
        flush();
        showTime = at != null;
        h = rowHeight(text, metrics, showTime);
      }
      cur.push({ ...msg, text, at, part: index });
      used += h;
      if (at != null) prevAt = at;
      if (h > budget) flush();
    });
  }
  flush();
  return pages;
}

function textBlocks(content) {
  if (typeof content === "string") return content.trim() ? [content] : [];
  if (!Array.isArray(content)) return [];
  const out = [];
  for (const block of content) {
    if (!block || typeof block !== "object") continue;
    if (block.type === "text" && String(block.text || "").trim()) out.push(block.text);
    else if (block.type === "image") out.push("[图片]");
  }
  return out;
}

function activeChain(entries) {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  let cur = entries.length ? entries[entries.length - 1] : null;
  const chain = [];
  const seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.push(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : null;
  }
  chain.reverse();
  return chain;
}

function contactName(chain) {
  let model = "";
  for (const entry of chain) {
    if (entry.type === "model_change" && entry.model) model = String(entry.model);
  }
  let leaf = model.split("/").pop() || "";
  leaf = leaf.replace(/-\d.*$/, "");
  if (!leaf) return "助手";
  return leaf[0].toUpperCase() + leaf.slice(1);
}

export function parseSession(text, format = "omp") {
  if (format !== "omp") throw new Error("第一版只支持 omp / pi");
  const entries = [];
  for (const line of String(text).split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (!obj || typeof obj !== "object") continue;
    if (obj.type === "session" || obj.type === "title") continue;
    if (obj.id) entries.push(obj);
  }
  const chain = activeChain(entries);
  const messages = [];
  for (const entry of chain) {
    if (entry.type !== "message") continue;
    const msg = entry.message || {};
    let side;
    if (msg.role === "user") {
      if (msg.attribution != null && msg.attribution !== "user") continue;
      side = "me";
    } else if (msg.role === "assistant") {
      side = "them";
    } else continue;
    const body = textBlocks(msg.content).join("\n").trim();
    if (!body || body.startsWith("<system")) continue;
    const at = entry.timestamp ? Date.parse(entry.timestamp) : NaN;
    messages.push({
      id: entry.id,
      side,
      text: body,
      at: Number.isNaN(at) ? null : at,
    });
  }
  if (!messages.length) throw new Error("没有可展示的用户或助手正文");
  return { format: "omp", contactName: contactName(chain), messages };
}

export function renderScreen(messages, opts = {}) {
  const name = opts.contactName || "助手";
  const avatars = {
    me: opts.avatars?.me || DEFAULT_ME,
    them: opts.avatars?.them || DEFAULT_THEM,
  };
  let prev = null;
  const body = [];
  messages.forEach((msg, index) => {
    const label = index === 0
      ? (msg.at != null ? `${cst(msg.at).m}月${cst(msg.at).day}日 ${clock(msg.at)}` : null)
      : formatGap(msg.at, prev);
    if (msg.at != null) prev = msg.at;
    if (label) body.push(`<div class="time">${esc(label)}</div>`);
    const side = msg.side === "me" ? "me" : "them";
    body.push(
      `<div class="row ${side}">` +
        `<div class="av ${side}" style="background-image:${cssUrl(avatars[side])}"></div>` +
        `<div class="bubble">${renderText(msg.text)}</div>` +
        `</div>`,
    );
  });
  return (
    `<div class="screen">` +
    `<header><div class="back">‹</div>` +
    `<div class="av them head-av" style="background-image:${cssUrl(avatars.them)}"></div>` +
    `<div class="who">${esc(name)}</div><div class="more">···</div></header>` +
    `<main>${body.join("\n")}</main></div>`
  );
}

export function renderDocument(opts) {
  const layout = opts.layout || "auto";
  const stageClass = layout === "pc" ? "stage is-pc" : "stage";
  const sheets = (opts.pages || []).map((page) => `<div class="sheet">${renderScreen(page.messages, opts)}</div>`).join("\n");
  const auto = layout === "auto"
    ? `<script>function sync(){var s=document.querySelector(".stage");if(s)s.classList.toggle("is-pc",innerWidth>=760)}sync();addEventListener("resize",sync);</script>`
    : "";
  const title = `与 ${esc(opts.contactName || "助手")} 的聊天`;
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${CHAT_CSS}</style>
</head>
<body style="margin:0">
<div class="${stageClass}">
${sheets}
</div>
${auto}
</body>
</html>
`;
}
