# ChatGPT Deep Research Width

A Manifest V3 browser extension for widening ChatGPT Deep Research reports, with `1.5x` and `2x` presets for better table and chart readability.

## Features

- Presets: `Default`, `1.5x`, `2x`
- Applies immediately from the popup
- Targets Deep Research views without changing normal chat pages
- Handles nested sandbox iframes used by the Deep Research report viewer

## How It Works

In ChatGPT Deep Research views, the visible report area is typically constrained by values such as:

- `--thread-content-max-width: 40rem`
- `@w-lg/main:[--thread-content-max-width:48rem]`

On larger screens this usually means an effective content width of roughly `48rem = 768px`, and the actual readable body can become narrower after padding and margins are applied. This makes wide tables and dense report layouts harder to read.

The extension uses a multi-layer strategy:

- Detect `iframe[title="internal://deep-research"]` in the main `chatgpt.com` / `chat.openai.com` page
- Widen the outer thread container and Deep Research shell
- Handle the sandboxed Deep Research frame under `*.web-sandbox.oaiusercontent.com`
- Inject a stylesheet into the innermost report document and override fixed `816px` widths with `!important`

This is necessary because the Deep Research report is rendered through nested sandboxed iframes. The innermost report document typically contains fixed-width nodes similar to:

- `div[style="width: 816px;"]`
- `div._reportPage_*`

## Project Structure

- `manifest.json`: extension manifest and permissions
- `popup.html`: popup UI
- `popup.css`: popup styles
- `popup.js`: saves the selected preset and applies it immediately to all frames in the active tab via `chrome.scripting`
- `content.js`: observes DOM changes and keeps width overrides applied across the main page, sandbox frame, and innermost report document

## Permissions

The extension uses:

- `storage`: persist the selected width preset
- `tabs`: identify the active tab
- `scripting`: apply width adjustments immediately across all frames in the active tab

Matched origins:

- `https://chatgpt.com/*`
- `https://chat.openai.com/*`
- `https://*.web-sandbox.oaiusercontent.com/*`

## Installation

### Load unpacked in Chrome or other Chromium browsers

1. Open `chrome://extensions/`
2. Enable `Developer mode`
3. Click `Load unpacked`
4. Select the project folder:

- `chatgpt-deep-research-width`

## Usage

1. Open a ChatGPT Deep Research report
2. Click the extension icon
3. Choose `Default`, `1.5x`, or `2x`
4. The current page updates immediately

## Compatibility

Expected to work in Chromium-based browsers, including:

- Chrome
- Edge
- Brave
- Vivaldi
- Arc

Not guaranteed to work as-is in:

- Firefox
- Safari

## Limitations

- If ChatGPT changes its frontend DOM structure, the selectors may need to be updated
- The current implementation targets the present Deep Research viewer structure and similar report layouts
- The width override currently assumes the report still uses fixed-width structures around `816px`; if the viewer layout changes, the injected rules may need to be revised
- The extension is intended for Chromium-based browsers and is not guaranteed to work in Firefox or Safari
