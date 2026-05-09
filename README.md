# Scholar Journal Highlighter

A Chrome extension that highlights research journals on Google Scholar based on their prestige rankings.

When you search on Google Scholar, matching journals appear with colored borders, background tints, and tier badges. Non-matching results can be dimmed or hidden.

## Supported Journal Lists

| List | Count | Color | Source |
|---|---|---|---|
| UTD24 | 24 | Purple | UT Dallas top 24 business journals |
| FT50 | 50 | Blue | Financial Times top 50 journals |
| ABDC (A*/A) | ~850 | Orange | Australian Business Deans Council (A* and A only) |
| My List | User-defined | Gray | Custom journals added via popup |

## Features

- Highlights on both search results and author profile pages
- Independent toggle for each journal list
- Non-matching results: show all, dim, or hide
- Custom journal list with add/remove UI
- Alias matching for abbreviated journal names (e.g., "JMR" for Journal of Marketing Research)
- Fuzzy substring matching as fallback
- Auto-updates journal data from GitHub (7-day cache)
- Works with Google Scholar's infinite scroll

## Install

1. Download the latest release zip from [Releases](../../releases)
2. Unzip to a folder
3. Open `chrome://extensions/` and enable Developer mode
4. Click "Load unpacked" and select the unzipped folder

## Development

### Project Structure

```
extension/          Chrome extension source
  manifest.json     Extension manifest (v3)
  content.js        Injects highlighting into Google Scholar pages
  background.js     Service worker for data fetching/caching
  popup.html/js/css  Settings popup UI
  journals.json     Bundled journal data (fallback)
  styles.css        Highlighting styles

data/               Journal source data
  utd24.json        UTD24 journal names
  ft50.json         FT50 journal names
  abdc.json         ABDC A*/A journals with ratings
  custom.json       Seed custom list (empty)
  journals.json     Merged build output
  utd24.csv         UTD24 reference CSV
  ft50.csv          FT50 reference CSV

scripts/            Build tools
  extract_abdc.py   Extract A*/A from ABDC xlsx
  build_journals.py Merge all lists into journals.json
```

### Updating Journal Data

**UTD24 or FT50** (rarely changes):
Edit `data/utd24.json` or `data/ft50.json` directly, then run the build.

**ABDC** (every 1-2 years):
1. Download the ABDC Journal Quality List xlsx from [abdc.edu.au](https://abdc.edu.au)
2. Place it in `data/` (any file matching `ABDC*.xlsx`)
3. Run: `python scripts/extract_abdc.py`
4. Delete the xlsx when done

**Build merged data:**
```bash
python scripts/build_journals.py
```
This outputs to both `data/journals.json` and `extension/journals.json`.

A GitHub Actions workflow also rebuilds automatically when source JSON files change on main.

**Auto-update for installed extensions:** The extension fetches journal data from this repo's `data/journals.json` on GitHub (7-day cache). When you push updated journal data, all installed extensions will pick up the new data within 7 days -- no reinstall needed.

### Releasing

1. Update version in `extension/manifest.json`
2. Commit and push
3. Create a GitHub Release tagged `vX.Y.Z` with a zip of the `extension/` folder
