# Correspondence layouts

Turns a Markdown letter or invoice into an A4 PDF for a C5 right-window envelope. Invoices take their line items, total and QR-bill data from Banana Accounting Plus. See `specs.md` for the full spec.

## Setup

```sh
pnpm install
pnpm exec playwright install chromium
pnpm setup                # once: puts pnpm's global bin dir on PATH
pnpm add -g link:$PWD     # makes `letter` available everywhere
```

The font Unica 77 LL must be installed.

## Usage

```sh
letter ~/Correspondence/2026/muster/2026-12-11-rechnung.md
# → ~/Correspondence/2026/muster/2026-12-11-rechnung.pdf
```

### Frontmatter

```yaml
type: invoice            # letter | invoice (required)
sender: business         # business (default) | personal
lang: de                 # de (default) | en
date: 2026-12-11         # letters: required; invoices: Banana's date
subject: Unterhalt muster-ag.ch            # required
recipient: |             # letters: required; invoices: Banana's customer address
  Muster AG
  Musterstrasse 12
  3000 Bern
invoice: ./2026-042.json        # invoices: Banana invoice JSON, relative to this file
timesheet: ./MUSTER-2026-11.json # optional attachment
signature: false         # true: signature image from the user config
title: Bewerbung         # optional second header line for business letters
```

In an invoice, a line `::items` places the items table; without it the table follows the text.

### User config

`~/.config/letter/config.json` (or `$LETTER_CONFIG`):

```json
{ "signature": "signature.png" }
```

The path is relative to the config file.

### Banana

Install `banana/ch.xeophin.letter.export-invoice.js` (in the accounting file) and `banana/ch.xeophin.letter.export-timesheet.js` (in the timesheet file) via Extensions → Manage Extensions → Add from file. Each asks what to export and where to save the JSON.
