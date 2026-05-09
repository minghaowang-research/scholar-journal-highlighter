# Scholar Journal Highlighter

A Chrome extension for business school students and researchers. Highlights top-tier journals on Google Scholar so you can quickly spot quality publications when searching for papers, checking citations, or browsing author profiles.

Focuses on UTD24, FT50, and ABDC (A*/A only) -- the journal lists that matter for business research.

Matching journals appear with colored borders, background tints, and tier badges. Non-matching results can be dimmed or hidden.

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

### Paper Access (v3.0)

- **Sci-Hub links**: adds a Sci-Hub button next to each search result title. Uses Semantic Scholar API to look up DOIs for accurate linking. Sci-Hub URL is user-configurable.
- **Library proxy**: adds a Library button that opens the paper through your institution's proxy (e.g., EZproxy, OpenAthens). Enter your proxy URL in settings -- works with any university.
- **Citation highlighting**: high-citation papers are visually emphasized (100+ green, 500+ blue, 1000+ purple).

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
  content.js        Injects highlighting + access buttons into Google Scholar
  background.js     Service worker for data fetching, DOI lookup, config
  popup.html/js/css  Settings popup UI
  journals.json     Bundled journal data (fallback)
  styles.css        Highlighting and button styles

data/               Journal source data and config
  utd24.json        UTD24 journal names
  ft50.json         FT50 journal names
  abdc.json         ABDC A*/A journals with ratings
  custom.json       Seed custom list (empty)
  journals.json     Merged build output
  config.json       Default Sci-Hub URL and proxy URL
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
2. Rename to `ABDC-JQL-2025.xlsx` and place in `data/`
3. Run: `python scripts/extract_abdc.py`
4. Run: `python scripts/build_journals.py`

**Build merged data:**
```bash
python scripts/build_journals.py
```
This outputs to both `data/journals.json` and `extension/journals.json`.

**Auto-update for installed extensions:** The extension fetches journal data and config from this repo on GitHub (7-day cache). When you push updated data, all installed extensions pick up changes within 7 days -- no reinstall needed.

**Updating Sci-Hub URL:** Edit `data/config.json` and push. Users can also override the URL in the extension popup settings.

### Releasing

1. Update version in `extension/manifest.json`
2. Commit and push
3. Create a GitHub Release tagged `vX.Y.Z` with a zip of the `extension/` folder
