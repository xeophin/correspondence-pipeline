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
type: invoice # letter | invoice (required)
sender: business # business (default) | personal
lang: de # de (default) | en
date: 2026-12-11 # letters: required; invoices: Banana's date
subject: Unterhalt muster-ag.ch # required
recipient: | # letters: required; invoices: Banana's customer address
  Muster AG
  Musterstrasse 12
  3000 Bern
invoice: ./2026-042.json # invoices: Banana invoice JSON, relative to this file
timesheet: ./MUSTER-2026-11.json # optional attachment
signature: false # true: signature image from the user config
title: Bewerbung # optional second header line for business letters
```

In an invoice, a line `::items` places the items table; without it the table follows the text.

### User config

`~/.config/letter/config.json` (or `$LETTER_CONFIG`):

```json
{
	"sender": {
		"name": "Hanna Beispiel",
		"street": "Beispielweg 1",
		"zip": "8000",
		"city": "Zürich",
		"country": "CH",
		"email": "hanna@example.org",
		"phone": "+41 44 000 00 00"
	},
	"brands": { "business": "example.org/studio", "personal": "hanna/beispiel" },
	"signature": "signature.png"
}
```

`sender` (return address, footer, QR-bill creditor) and `brands` (header, one per `sender:` value) are required; `signature` is optional and its path is relative to the config file. `examples/config.json` holds fictional values and is what the tests use.

### Banana

Install `banana/net.xeophin.letter.export-invoice.js` (in the accounting file) and `banana/net.xeophin.letter.export-timesheet.js` (in the timesheet file) via Extensions → Manage Extensions → Add from file. Each asks what to export and where to save the JSON.
