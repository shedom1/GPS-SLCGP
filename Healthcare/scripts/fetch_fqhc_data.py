#!/usr/bin/env python3
"""Refresh local data files for the FQHC Prospect Lookup static GitHub Pages app.

Why this exists:
  Browsers often block direct JavaScript fetches to HRSA/CMS/USDA files because
  of CORS, redirects, MIME headers, or large file download behavior. GitHub
  Actions runs this server-side, commits clean local files to /data/, and the
  static HTML reads same-origin files without cross-domain browser fetches.

Run locally from the project root:
  pip install -r requirements.txt
  python scripts/fetch_fqhc_data.py
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
DATA.mkdir(exist_ok=True)

URLS = {
    "hrsa_sites_csv": "https://data.hrsa.gov/DataDownload/DD_Files/Health_Center_Service_Delivery_and_LookAlike_Sites.csv",
    "cms_enrollments_api": "https://data.cms.gov/data-api/v1/dataset/4bcae866-3411-439a-b762-90a6187c194b/data",
    "cms_owners_api": "https://data.cms.gov/data-api/v1/dataset/ed289c89-0bb8-4221-a20a-85776066381b/data",
    "ruca_xlsx": "https://ers.usda.gov/sites/default/files/_laserfiche/DataFiles/53241/RUCA-codes-2020-zipcode.xlsx?v=32088",
    "forhp_xlsx": "https://www.hrsa.gov/sites/default/files/hrsa/rural-health/about/rural-zip-code-approximations.xlsx",
}


def download(url: str, timeout: int = 90) -> bytes:
    headers = {"User-Agent": "Mozilla/5.0 FQHC-Prospect-Tracker/1.0"}
    r = requests.get(url, headers=headers, timeout=timeout)
    r.raise_for_status()
    return r.content


def normalize_zip(value: Any) -> str:
    s = "" if pd.isna(value) else str(value)
    digits = "".join(ch for ch in s if ch.isdigit())
    return digits[:5].zfill(5) if digits else ""


def first_matching_column(df: pd.DataFrame, candidates: list[str]) -> str | None:
    norm_map = {"".join(ch.lower() for ch in c if ch.isalnum()): c for c in df.columns}
    for cand in candidates:
        key = "".join(ch.lower() for ch in cand if ch.isalnum())
        if key in norm_map:
            return norm_map[key]
    return None


def fetch_hrsa_sites() -> int:
    content = download(URLS["hrsa_sites_csv"])
    path = DATA / "hrsa_sites.csv"
    path.write_bytes(content)
    try:
        return len(pd.read_csv(path, dtype=str, low_memory=False))
    except Exception:
        return -1


def fetch_api_all(url: str, max_rows: int = 100_000, page_size: int = 5_000) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for offset in range(0, max_rows, page_size):
        sep = "&" if "?" in url else "?"
        batch = requests.get(f"{url}{sep}size={page_size}&offset={offset}", timeout=90).json()
        if not isinstance(batch, list) or not batch:
            break
        rows.extend(batch)
        if len(batch) < page_size:
            break
    return rows


def fetch_cms_json(name: str, url: str) -> int:
    rows = fetch_api_all(url)
    (DATA / name).write_text(json.dumps(rows, indent=2), encoding="utf-8")
    return len(rows)


def fetch_xlsx_to_csv(url: str, output_name: str, kind: str) -> int:
    temp = DATA / f"_{output_name}.xlsx"
    temp.write_bytes(download(url))
    xls = pd.ExcelFile(temp)
    best_df = None
    for sheet in xls.sheet_names:
        df = pd.read_excel(temp, sheet_name=sheet, dtype=str)
        if len(df) and (best_df is None or len(df) > len(best_df)):
            best_df = df
    if best_df is None:
        raise RuntimeError(f"No worksheet rows found in {url}")
    df = best_df.copy()

    if kind == "ruca":
        zip_col = first_matching_column(df, ["ZIP_CODE", "ZIP Code", "ZIP", "ZCTA", "ZIPCODE"])
        ruca_col = first_matching_column(df, ["RUCA1", "RUCA Code", "Primary RUCA Code", "RUCA_CODE", "RUCA"])
        desc_col = first_matching_column(df, ["Primary RUCA Description", "RUCA Description", "Description"])
        out = pd.DataFrame()
        out["ZIP_CODE"] = df[zip_col].map(normalize_zip) if zip_col else ""
        out["RUCA_CODE"] = df[ruca_col].astype(str).str.extract(r"(99|10|[1-9](?:\.\d+)?)", expand=False).fillna("") if ruca_col else ""
        out["RUCA_DESCRIPTION"] = df[desc_col] if desc_col else ""
    else:
        zip_col = first_matching_column(df, ["ZIP Code", "ZIP_CODE", "ZIP", "Zip", "ZIPCODE"])
        rural_col = first_matching_column(df, ["FORHP Rural", "FORHP_Rural", "Rural", "Rural Status", "Rural Flag"])
        out = pd.DataFrame()
        out["ZIP_CODE"] = df[zip_col].map(normalize_zip) if zip_col else ""
        out["FORHP_RURAL"] = df[rural_col] if rural_col else "Yes"

    out = out[out["ZIP_CODE"].astype(str).str.len() == 5].drop_duplicates()
    out.to_csv(DATA / output_name, index=False)
    try:
        temp.unlink()
    except OSError:
        pass
    return len(out)


def main() -> int:
    manifest: dict[str, Any] = {"refreshed_at": datetime.now(timezone.utc).isoformat(timespec="seconds"), "sources": {}}
    jobs = [
        ("hrsa_sites.csv", lambda: fetch_hrsa_sites()),
        ("cms_enrollments.json", lambda: fetch_cms_json("cms_enrollments.json", URLS["cms_enrollments_api"])),
        ("cms_owners.json", lambda: fetch_cms_json("cms_owners.json", URLS["cms_owners_api"])),
        ("ruca_zip.csv", lambda: fetch_xlsx_to_csv(URLS["ruca_xlsx"], "ruca_zip.csv", "ruca")),
        ("forhp_rural_zips.csv", lambda: fetch_xlsx_to_csv(URLS["forhp_xlsx"], "forhp_rural_zips.csv", "forhp")),
    ]

    failures = []
    for name, fn in jobs:
        try:
            rows = fn()
            manifest["sources"][name] = {"status": "ok", "rows": rows}
            print(f"OK {name}: {rows} rows")
        except Exception as exc:
            manifest["sources"][name] = {"status": "failed", "error": str(exc)}
            failures.append((name, exc))
            print(f"FAILED {name}: {exc}", file=sys.stderr)

    (DATA / "source_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    return 1 if failures and len(failures) == len(jobs) else 0


if __name__ == "__main__":
    raise SystemExit(main())
