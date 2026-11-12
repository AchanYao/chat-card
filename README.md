# chat-card

把 omp/pi 的 session JSONL 渲染成分页的微信式 HTML。网页、CLI 和 MCP 共用 `lib/core.js`。文件只在本机读取。

## 目录

- `bin/chat-card.mjs`：命令行和 MCP。
- `lib/core.js`：解析、分页和 HTML。
- `vendor/html2canvas.min.js`：导出 PNG 用的 html2canvas。
- `test/`：测试。
- `examples/`：示例会话。
- `index.html`、`site.css`、`site.js`：网页。GitHub Pages 仍然发布仓库根目录。

## 安装

需要 Node.js 22 或更新版本。

```bash
git clone https://github.com/AchanYao/chat-card.git
cd chat-card
```

不克隆仓库也可以：

```bash
npx github:AchanYao/chat-card --help
```

这个包没有发布到 npm registry（`private: true`）。

## 命令行

```bash
node bin/chat-card.mjs render examples/omp-session.jsonl -o out.html --layout pc
```

```bash
npx github:AchanYao/chat-card render examples/omp-session.jsonl -o out.html --layout pc
```

- `--layout phone|pc|auto`：默认 `auto`。`auto` 按手机宽度分页，宽窗口只改变外观。
- `--format omp|claude|codex|grok|auto`：会话格式。默认 `omp`。`auto` 按文件识别。网页上传总会识别并切换。
- `--name`：顶栏昵称。
- `-o`、`--out`：输出 HTML 的路径。
- `--avatar-me`：我的头像图片。
- `--avatar-them`：对方头像图片。
- `--version`、`-V`：打印版本后退出。

`chat-card` 和 `node bin/chat-card.mjs` 是同一个程序。`--help` 与不带参数都会打印帮助并退出。

## 网页

从仓库根目录发布 GitHub Pages。本地：

```bash
npx --yes serve .
```

必须用 http。`file://` 加载不了模块。

编辑时选择 JSONL、头像、昵称、版式，以及要保留哪些气泡。预览可以保存一张 PNG，或把全部页面打成一个 zip。单页预算约 4000px，先按消息边界拆，再按段落拆。

导出 PNG 使用仓库自带的 `vendor/html2canvas.min.js`（html2canvas 1.4.1，MIT，Copyright 2022 Niklas von Hertzen，https://html2canvas.hertzen.com）。

## MCP

stdio，工具名 `render_chat`。字段与命令行相同：`path`、`format`、`layout`、`name`、`out`、`avatarMe`、`avatarThem`。

```json
{
  "mcpServers": {
    "chat-card": {
      "command": "npx",
      "args": ["-y", "github:AchanYao/chat-card", "mcp"]
    }
  }
}
```

已经克隆时，把 `command` 设为 `node`，`args` 设为该克隆里的 `bin/chat-card.mjs` 再加 `mcp`。

工具只写 HTML。

## 开发

```bash
npm test
```

`npm test` 运行 `node --test`。

## 范围

只保留用户和助手的正文。思考、工具调用、工具结果和后台任务都会略过。图片渲染成「图片」，blob 图片不会还原。不支持 ChatGPT 导出。不发布到 npm。

## 许可证

[MIT](LICENSE)。
