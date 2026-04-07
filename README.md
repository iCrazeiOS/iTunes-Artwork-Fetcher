# iTunes Artwork Fetcher

A lightweight desktop app for searching and downloading high-resolution artwork from the iTunes catalog.

Built with [Tauri v2](https://v2.tauri.app) and vanilla HTML/CSS/JS.

## Features

- Search albums, movies, TV shows, podcasts, music videos, audiobooks, books, apps, and short films
- Responsive image grid with configurable resolution (100–1500px)
- Right-click context menu to copy or save images (including full resolution)
- Drag images directly to Finder/Desktop to save as files
- Click to preview artwork in a modal overlay
- Keyboard navigation (Tab to search, arrow keys to browse, Escape to dismiss)
- Light/dark theme (follows system preference)
- Country selector (defaults to system locale)

## Development

Requires [Rust](https://rustup.rs), [Bun](https://bun.sh), and platform-specific Tauri [prerequisites](https://v2.tauri.app/start/prerequisites/).

```sh
bun install
bun tauri dev
```

## Build

### Prerequisites

All platforms require [Rust](https://rustup.rs) and [Bun](https://bun.sh).

| Platform | Additional dependencies |
|----------|------------------------|
| **Windows** | [WebView2](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (preinstalled on Windows 11) |
| **macOS** | Xcode Command Line Tools (`xcode-select --install`) |
| **Linux** | See [Tauri prerequisites for Linux](https://v2.tauri.app/start/prerequisites/#linux) — typically `libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, and others depending on distro |

### Compile

Tauri builds for the current platform only — cross-compilation is not supported. Run these commands on each target OS:

```sh
bun install
bun tauri build
```

The output will be in `src-tauri/target/release/bundle/`:

| Platform | Output |
|----------|--------|
| **Windows** | `bundle/nsis/` (.exe installer) |
| **macOS** | `bundle/dmg/` (.dmg) and `bundle/macos/` (.app) |
| **Linux** | `bundle/deb/` (.deb) and `bundle/appimage/` (.AppImage) |
