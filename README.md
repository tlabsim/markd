<p align="center">
  <img src="src/renderer/assets/markd.svg" width="64" alt="Markd" />
</p>

<h1 align="center">Markd</h1>

<p align="center">
  A beautiful, feature-rich desktop Markdown editor with live preview.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue" alt="Platform" />
  <img src="https://img.shields.io/badge/built%20with-Electron-47848f" alt="Electron" />
  <img src="https://img.shields.io/badge/React-18-61dafb" alt="React" />
  <img src="https://img.shields.io/badge/Tailwind-3-38bdf8" alt="Tailwind" />
</p>

---

## Features

- **Live Preview** — side-by-side editor and rendered HTML preview with synchronized scrolling
- **Syntax Highlighting** — toggleable syntax highlighting in the editor for Markdown, code fences, and inline code
- **Smart Editing** — automatic list continuation, task list toggling, bracket wrapping, and tab/shift-tab indentation
- **Search & Replace** — regex and case-sensitive search with replace and replace-all
- **Palette System** — multiple color palettes (Default, Sepia, High Contrast, Cool) with light/dark mode
- **Distraction-Free Mode** — fullscreen writing mode with centered preview
- **File Management** — sidebar with file tree, recent files, and folder browsing
- **GitHub-Flavored Markdown** — tables, task lists, strikethrough, footnotes, emoji, and syntax-highlighted code blocks
- **Math Support** — LaTeX math rendering via KaTeX
- **Export** — copy rendered HTML or export the preview

## Tech Stack

| Layer | Technology |
|-------|------------|
| Shell | Electron 31 |
| UI | React 18 + TypeScript |
| Styling | Tailwind CSS 3 + custom properties |
| State | Zustand v4 |
| Markdown | react-markdown + remark-gfm + rehype-highlight |
| Math | KaTeX |
| Build | Vite 5 + electron-builder |

## Development

```bash
# Install dependencies
npm install

# Run in development mode (Vite + Electron)
npm run dev

# Build for production
npm run build

# Package for Windows
npm run dist:win
```

## License

MIT
