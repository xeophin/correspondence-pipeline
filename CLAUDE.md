# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Purpose

This repo holds the parts of a correspondence pipeline:

1. Letters are written as Markdown files; the text is the body, and metadata (recipient, date, subject, etc.) lives in YAML frontmatter.
2. The Markdown files act as the data source and are combined with an HTML template.
3. The resulting HTML page is turned into a PDF.

Astro is used to author the HTML templates (layouts). The repo currently is the untouched Astro "minimal" starter (`src/pages/index.astro` only).

## Commands

Package manager is pnpm (Node >= 22.23.4). Astro 7.

- `pnpm install` — install dependencies
- `pnpm dev` — dev server (see AGENTS.md: use `astro dev --background` and manage it with `astro dev stop|status|logs`)
- `pnpm build` — static build to `dist/`
- `pnpm preview` — serve the build
- `pnpm astro check` — type check (only works once `@astrojs/check` and `typescript` are installed; not currently a dependency)

There is no test or lint setup yet.

## Open architecture decision

Not yet decided: whether Astro also merges the Markdown with the templates (e.g. via a content collection that reads the frontmatter, one page per letter), or whether Astro only builds templates containing placeholders that a separate process fills in. Do not assume either; ask or propose before building on one. When decided, record it in the log below and update this section.

The HTML-to-PDF step (tool/engine) is also undecided.

## Keeping context across sessions

Claude's own session memory is not part of the repo, so durable project knowledge must be written down here.

- Record decisions (and why) in the **Decision log** below, as they are made.
- Keep this file current: when commands, structure, or conventions change, update it in the same change.
- Put detailed material (template placeholder spec, frontmatter schema, PDF/print CSS notes) in `docs/` and link it from here rather than growing this file.

## Decision log

- 2026-11-17: Repo initialised from the Astro minimal template; pipeline concept defined (see Purpose). Merge strategy and PDF engine still open.
