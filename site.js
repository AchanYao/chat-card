import {
  CHAT_CSS,
  DEFAULT_ME,
  DEFAULT_THEM,
  FORMATS,
  PAGE_MAX,
  PRESETS,
  paginate,
  parseSession,
  renderScreen,
} from "./lib/core.js";

const style = document.createElement("style");
style.textContent = CHAT_CSS;
document.head.appendChild(style);

const state = {
  text: "",
  session: null,
  hidden: new Set(),
  name: "",
  layout: "auto",
  preset: "g",
  avatarThem: DEFAULT_THEM,
  avatarMe: DEFAULT_ME,
  page: 0,
  pages: [],
  resolved: "phone",
};

const $ = (id) => document.getElementById(id);

function showError(message) {
  const el = $("error");
  el.hidden = !message;
  el.textContent = message || "";
}

async function square(file) {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = 80;
  canvas.height = 80;
  const ctx = canvas.getContext("2d");
  const side = Math.min(bitmap.width, bitmap.height);
  ctx.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    80,
    80,
  );
  bitmap.close();
  return canvas.toDataURL("image/png");
}

function fillPresets() {
  const box = $("presets");
  for (const preset of PRESETS) {
    const button = document.createElement("button");
    button.type = "button";
    button.title = preset.label;
    button.setAttribute("aria-pressed", String(preset.id === state.preset));
    const img = document.createElement("img");
    img.alt = preset.label;
    img.src = preset.url;
    button.append(img);
    button.addEventListener("click", () => {
      state.preset = preset.id;
      state.avatarThem = preset.url;
      for (const peer of box.querySelectorAll("button")) peer.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-pressed", "true");
    });
    box.append(button);
  }
  $("me-preview").src = state.avatarMe;
}

function fillFormats() {
  const select = $("format");
  for (const format of FORMATS) {
    const option = document.createElement("option");
    option.value = format.id;
    option.textContent = format.label;
    select.append(option);
  }
}

function renderMessages() {
  const list = $("messages");
  list.replaceChildren();
  if (!state.session) return;
  state.session.messages.forEach((msg, index) => {
    const item = document.createElement("li");
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = !state.hidden.has(index);
    box.addEventListener("change", () => {
      if (box.checked) state.hidden.delete(index);
      else state.hidden.add(index);
    });
    const side = document.createElement("span");
    side.className = "who-side";
    side.textContent = msg.side === "me" ? "我" : "对方";
    const snippet = document.createElement("span");
    snippet.className = "snippet";
    snippet.textContent = msg.text.replace(/\s+/g, " ");
    item.append(box, side, snippet);
    list.append(item);
  });
}

function loadText(name, text) {
  try {
    state.session = parseSession(text, $("format").value);
    state.text = text;
    state.hidden = new Set();
    state.name = state.session.contactName;
    $("name").value = state.name;
    $("file-label").textContent = name;
    $("preview").disabled = false;
    showError("");
    renderMessages();
  } catch (err) {
    state.session = null;
    $("preview").disabled = true;
    renderMessages();
    showError(err.message);
  }
}

function resolvedLayout() {
  if (state.layout === "phone" || state.layout === "pc") return state.layout;
  return window.innerWidth >= 760 ? "pc" : "phone";
}

function visible() {
  return state.session.messages.filter((_, index) => !state.hidden.has(index));
}

function contentWidth(layout) {
  const bubble = $("stage").querySelector(".bubble");
  if (!bubble) return layout === "pc" ? 836 : 268;
  const styleOf = getComputedStyle(bubble);
  const pad = parseFloat(styleOf.paddingLeft) + parseFloat(styleOf.paddingRight);
  return Math.max(120, bubble.clientWidth - pad);
}

function paint(layout) {
  const page = state.pages[state.page];
  const stage = $("stage");
  stage.className = `stage live${layout === "pc" ? " is-pc" : ""}`;
  stage.innerHTML = page ? renderScreen(page.messages, {
    contactName: state.name || "助手",
    avatars: { me: state.avatarMe, them: state.avatarThem },
  }) : "";
  const count = state.pages.length;
  $("pager").textContent = count ? `${state.page + 1} / ${count}` : "0 / 0";
  $("prev").disabled = state.page <= 0;
  $("next").disabled = state.page >= count - 1;
  $("save").disabled = !page;
  $("save-all").disabled = !count;
}

function rebuild() {
  const messages = visible();
  if (!messages.length) {
    state.pages = [];
    state.page = 0;
    paint(resolvedLayout());
    showError("至少保留一条消息");
    return;
  }
  showError("");
  let layout = resolvedLayout();
  let width;
  state.pages = paginate(messages, { layout, contentWidth: width, pageMax: PAGE_MAX });
  state.page = Math.min(state.page, Math.max(0, state.pages.length - 1));
  paint(layout);
  const measured = contentWidth(layout);
  const assumed = layout === "pc" ? 836 : 268;
  if (Math.abs(measured - assumed) > 24) {
    state.pages = paginate(messages, { layout, contentWidth: measured, pageMax: PAGE_MAX });
    state.page = Math.min(state.page, Math.max(0, state.pages.length - 1));
    paint(layout);
  }
  state.resolved = layout;
  const tooTall = $("stage").querySelector(".screen")?.scrollHeight || 0;
  if (tooTall > PAGE_MAX + 80) {
    showError(`这一页高 ${tooTall}px，超过分页预算。请再藏掉几条，或把超长代码留在 HTML 里看。`);
  }
}

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    c ^= bytes[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function concat(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function zipStore(files) {
  const enc = new TextEncoder();
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = enc.encode(file.name);
    const crc = crc32(file.data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, file.data.length, true);
    local.setUint32(22, file.data.length, true);
    local.setUint16(26, name.length, true);
    const localBytes = concat([new Uint8Array(local.buffer), name, file.data]);
    locals.push(localBytes);
    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(12, time, true);
    central.setUint16(14, date, true);
    central.setUint32(16, crc, true);
    central.setUint32(20, file.data.length, true);
    central.setUint32(24, file.data.length, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, offset, true);
    centrals.push(concat([new Uint8Array(central.buffer), name]));
    offset += localBytes.length;
  }
  const centralBlob = concat(centrals);
  const eocd = new DataView(new ArrayBuffer(22));
  eocd.setUint32(0, 0x06054b50, true);
  eocd.setUint16(8, files.length, true);
  eocd.setUint16(10, files.length, true);
  eocd.setUint32(12, centralBlob.length, true);
  eocd.setUint32(16, offset, true);
  return concat([...locals, centralBlob, new Uint8Array(eocd.buffer)]);
}

function download(bytes, name, type) {
  const blob = bytes instanceof Blob ? bytes : new Blob([bytes], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = name;
  link.click();
  URL.revokeObjectURL(link.href);
}

async function rasterize() {
  const screen = $("stage").querySelector(".screen");
  if (!screen) throw new Error("没有可保存的页");
  const height = screen.offsetHeight;
  if (height > 8000) throw new Error("这一页仍然太高，存不了图");
  const canvas = await window.html2canvas(screen, {
    backgroundColor: getComputedStyle(screen).backgroundColor,
    scale: Math.min(2, window.devicePixelRatio || 1),
    width: screen.offsetWidth,
    height,
  });
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("截图失败");
  return blob;
}

async function saveCurrent() {
  $("status").textContent = "正在保存…";
  try {
    const blob = await rasterize();
    download(blob, `chat-card-${state.page + 1}.png`, "image/png");
    $("status").textContent = "";
  } catch (err) {
    $("status").textContent = err.message;
  }
}

async function saveAll() {
  const files = [];
  const previous = state.page;
  $("status").textContent = "正在保存…";
  try {
    for (let i = 0; i < state.pages.length; i++) {
      state.page = i;
      paint(state.resolved);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const blob = await rasterize();
      files.push({ name: `chat-card-${i + 1}.png`, data: new Uint8Array(await blob.arrayBuffer()) });
      $("status").textContent = `正在保存 ${i + 1}/${state.pages.length}`;
    }
    download(zipStore(files), "chat-card.zip", "application/zip");
    $("status").textContent = "";
  } catch (err) {
    $("status").textContent = err.message;
  } finally {
    state.page = previous;
    paint(state.resolved);
  }
}

function openPreview() {
  state.name = $("name").value.trim() || state.session.contactName;
  state.layout = $("layout").value;
  state.page = 0;
  rebuild();
  if (!state.pages.length) return;
  document.body.classList.add("previewing");
  $("editor").hidden = true;
  $("preview-view").hidden = false;
}

function closePreview() {
  document.body.classList.remove("previewing");
  $("editor").hidden = false;
  $("preview-view").hidden = true;
}

fillFormats();
fillPresets();

$("file").addEventListener("change", async () => {
  const file = $("file").files[0];
  if (!file) return;
  loadText(file.name, await file.text());
});

$("format").addEventListener("change", () => {
  if (state.text) loadText($("file-label").textContent, state.text);
});

$("avatar-them").addEventListener("change", async () => {
  const file = $("avatar-them").files[0];
  if (!file) return;
  state.avatarThem = await square(file);
  state.preset = "";
  for (const button of $("presets").querySelectorAll("button")) button.setAttribute("aria-pressed", "false");
});

$("avatar-me").addEventListener("change", async () => {
  const file = $("avatar-me").files[0];
  if (!file) return;
  state.avatarMe = await square(file);
  $("me-preview").src = state.avatarMe;
});

const drop = $("drop");
drop.addEventListener("dragover", (event) => {
  event.preventDefault();
  drop.classList.add("over");
});
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", async (event) => {
  event.preventDefault();
  drop.classList.remove("over");
  const file = event.dataTransfer.files[0];
  if (!file) return;
  loadText(file.name, await file.text());
});

$("preview").addEventListener("click", openPreview);
$("back").addEventListener("click", closePreview);
$("prev").addEventListener("click", () => {
  state.page -= 1;
  paint(state.resolved);
});
$("next").addEventListener("click", () => {
  state.page += 1;
  paint(state.resolved);
});
$("save").addEventListener("click", saveCurrent);
$("save-all").addEventListener("click", saveAll);
window.addEventListener("resize", () => {
  if ($("preview-view").hidden) return;
  if (state.layout !== "auto") return;
  const next = resolvedLayout();
  if (next !== state.resolved) rebuild();
});
