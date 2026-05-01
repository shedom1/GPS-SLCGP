# RUS DLT FY2026 TSP HTML Build Tool

This is a GitHub Pages-ready single-page HTML tool for building a USDA RUS DLT Telecommunications System Plan (TSP) table from an uploaded budget.

## Files

- `index.html` — main web application. GitHub Pages will load this automatically.
- `.nojekyll` — prevents GitHub Pages from applying Jekyll processing.
- `README.md` — deployment notes.

## Deploy to GitHub Pages

1. Create or open the GitHub repository where this tool will live.
2. Upload the contents of this ZIP to the repository root.
3. Go to **Settings > Pages**.
4. Under **Build and deployment**, choose:
   - Source: **Deploy from a branch**
   - Branch: `main` / `/root`
5. Save.
6. Open the GitHub Pages URL after deployment completes.

## Notes

The tool uses a browser-based Excel library from a CDN for workbook upload and export. Excel import/export requires internet access unless the SheetJS library is embedded locally in a future version.

