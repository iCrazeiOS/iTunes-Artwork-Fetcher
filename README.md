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

```sh
bun tauri build
```

The built app bundle will be in `src-tauri/target/release/bundle/`.
