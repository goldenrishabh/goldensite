# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Personal static site served from GitHub Pages at `thegoldenrishabh.com` (CNAME). No framework, no build step — plain HTML + Tailwind (CDN) + vanilla ES6. Jekyll is effectively disabled (`.nojekyll`, empty `plugins` in `_config.yml`).

## Common commands

```bash
node bin/blog generate   # process raw/*.md → blog/<category>/*.md, rebuild blog-index.json and static-blog/
node bin/blog publish    # git add -A && commit "Publish blog updates" && push
node generate-blog-index.js   # just rebuild blog-index.json + mirror to static-blog/ (no raw processing)
```

There are no tests, no linter, and no dev server. To preview, open the HTML files directly or run any static server from the repo root (e.g. `python3 -m http.server`) so `fetch('blog-index.json')` works.

## Architecture

### Two parallel content trees: `blog/` and `static-blog/`

This is the single most important thing to understand before editing blog code.

- `blog/<category>/<id>.md` — canonical markdown sources (with frontmatter). This is what authors edit.
- `static-blog/<category>/<id>.txt` — **generated mirror** of the same content but with a `.txt` extension. Image directories (`images-*`) are also copied across.
- `blog-index.json` — generated index listing categories and posts. Each post entry points at the `static-blog/.../<id>.txt` path, not the `.md`.

The `.txt` mirror exists because some static hosts (and Jekyll, if it ever re-activates) mis-handle raw `.md` — serving `.txt` guarantees the client receives the raw markdown source. `js/blog-post.js` and `js/main.js` fetch `blog-index.json`, then `fetch(postInfo.file)` where `file` is the `static-blog/.../<id>.txt` path, and parse frontmatter + markdown client-side via `marked`.

**Never edit `static-blog/` or `blog-index.json` by hand.** Always regenerate via `node bin/blog generate` (or `node generate-blog-index.js` if you only touched `blog/`).

### Content pipeline

1. Author writes a post in `raw/<name>.md` with YAML-ish frontmatter (`title`, `category`, `date`, optional `excerpt`/`tags`/`readTime`).
2. `bin/blog generate` (see `bin/blog`):
   - Skips files without frontmatter and skips `booksread.md` (utility file, also cleans up any stray generated copies).
   - Slugs the filename, computes `readTime` from word count (225 wpm), fills missing `date`.
   - Writes to `blog/<category>/<slug>.md`.
   - Calls `generateBlogIndex()` from `generate-blog-index.js`, which walks `blog/`, mirrors each `.md` into `static-blog/<category>/<slug>.txt`, copies `images-*` dirs, and writes `blog-index.json` with posts sorted by date desc.
3. `bin/blog publish` commits and pushes.

Category metadata (display name, description, color) is defined in `DEFAULT_CATEGORIES` inside `generate-blog-index.js`. Unknown categories get a gray fallback — add them there for proper styling.

### Pages and their JS

- `index.html` + `js/main.js` — homepage. Single `PersonalWebsite` class handles theme, nav scroll-spy, category filtering, search, "latest updates" modal, and renders blog cards from `blog-index.json`.
- `blogs.html` — blog listing page (shares `js/main.js` logic).
- `blog-post.html` + `js/blog-post.js` — single-post view. Reads `?id=<post-id>` from the URL, looks it up in `blog-index.json`, fetches the `static-blog/.../<id>.txt`, parses frontmatter, renders with `marked`.
- `admin.html` + `js/admin.js` — in-browser CMS (see below).

All pages use the same cream-palette Tailwind config (inline in each HTML file) with dark-mode class on `<html>`. Theme preference is persisted in `localStorage['theme']`.

### Admin panel (`admin.html` / `js/admin.js`)

A browser-only CMS that commits directly to GitHub via the REST API using a personal access token stored in `localStorage['admin_github_token']`. No server component.

- `ADMIN_CONFIG` at the top of `js/admin.js` hardcodes `repoOwner: 'goldenrishabh'`, `repoName: 'goldensite'`, `branch: 'main'`, and `allowedUsers: ['goldenrishabh']`. Any edits to repo/branch/allowed users live there.
- `GitHubAPI.commitFiles()` builds a git tree manually (blobs → tree → commit → update ref) so multi-file commits (post + updated index + images) land atomically.
- Supports drafts (stored in `blogIndex.drafts` alongside `posts` — regular `generate-blog-index.js` only tracks `posts`, so the admin panel manages drafts separately in the JSON).
- Handles two upload types: images (to `blog/<category>/images-<slug>/`, referenced relatively from posts) and HTML/Three.js animations (to `blog-animations/<timestamp>-<name>.html`, embedded via `<div class="animation-embed">` with a tap-to-interact shield rendered by `js/blog-post.js`).
- `listDirectory('blog-animations')` / `listDirectory('blog-images')` back a media library with unused-file cleanup.

When editing `js/admin.js`, remember it runs in the browser — it duplicates `parseFrontmatter`/`stringifyFrontmatter`/`calculateReadingTime` from `bin/blog` and `generate-blog-index.js`. Keep those three implementations in sync when changing frontmatter semantics or reading-time heuristics.

### Frontmatter parsing — shared quirks

All three parsers (`bin/blog`, `generate-blog-index.js`, `js/admin.js`) use the same hand-rolled parser:
- Regex `^---\n([\s\S]*?)\n---\n([\s\S]*)$` — requires a **trailing newline** after the closing `---`.
- `key: value` per line, one level deep only. No nested objects.
- Arrays are bracketed and comma-split: `tags: [a, b, c]`. Quotes inside are stripped.
- Quoted strings (`"..."` or `'...'`) have outer quotes stripped.

Don't introduce YAML edge cases (multiline strings, nested maps) — they won't parse.

## Deployment

Pushing to `main` deploys via GitHub Pages. `_config.yml` keeps Jekyll mostly out of the way but still present; `.nojekyll` would fully disable it if needed. The admin panel's commits trigger the same deploy path.
