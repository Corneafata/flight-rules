#!/usr/bin/env python3
"""Rebuilds the environment record for "The Long Night" from official services.

Standard library only. No API keys needed.
  python3 pipeline/fetch_records.py            -> writes pipeline/out/long_night.json and prints checksums
Compare the printed checksums with `meta.checksums` in src/data/longNight.js.

Sources
  - NASA/JPL Horizons API: Sun (10) and Earth (399) apparent elevation from a site on the Moon (coord@301)
  - NASA CCMC DONKI API: SEP and FLR events (base URL moved on 2026-09-30 to ccmc.gsfc.nasa.gov/DONKI-API)
"""
import json
import pathlib
import sys
import urllib.parse
import urllib.request

SITE = "32.32,-69.37,0"  # E-longitude, latitude, altitude (km) of the Chandrayaan-3 Vikram landing site
START, STOP, STEP = "2023-08-20", "2023-10-01", "6 h"
HORIZONS = "https://ssd.jpl.nasa.gov/api/horizons.api"
DONKI = "https://ccmc.gsfc.nasa.gov/DONKI-API/get/"


def get(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": "flight-rules-pipeline/1.0 (NASA Space Apps 2026)"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8")


def horizons_elevations(target):
    q = {
        "format": "text", "COMMAND": f"'{target}'", "OBJ_DATA": "'NO'", "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'", "CENTER": "'coord@301'", "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{SITE}'", "START_TIME": f"'{START}'", "STOP_TIME": f"'{STOP}'",
        "STEP_SIZE": f"'{STEP}'", "QUANTITIES": "'4'", "ANG_FORMAT": "'DEG'", "CSV_FORMAT": "'YES'",
    }
    text = get(HORIZONS + "?" + urllib.parse.urlencode(q))
    if "$$SOE" not in text:
        raise RuntimeError("Horizons returned no ephemeris:\n" + text[:2000])
    rows = text.split("$$SOE")[1].split("$$EOE")[0].strip().splitlines()
    elev = []
    for row in rows:
        cols = [c.strip() for c in row.split(",")]
        elev.append(float(cols[4]))  # date, solar flag, interferer flag, azimuth, elevation
    return elev


def donki(kind):
    return json.loads(get(f"{DONKI}{kind}?startDate={START}&endDate={STOP}"))


def main():
    sun = [round(x, 2) for x in horizons_elevations("10")]
    earth = [round(x, 1) for x in horizons_elevations("399")]
    sep = donki("SEP")
    flr = [f for f in donki("FLR") if (f.get("classType") or "").startswith(("X", "M5", "M6", "M7", "M8", "M9"))]
    out = {
        "sunElevDeg": sun,
        "earthElevDeg": earth,
        "sep": [{"id": e["sepID"], "timeUTC": e["eventTime"], "instruments": [i["displayName"] for i in e.get("instruments", [])]} for e in sep],
        "flares": [{"id": f["flrID"], "peakUTC": f["peakTime"], "class": f["classType"]} for f in flr],
        "checksums": {"n": len(sun), "sunElevSum": round(sum(sun), 2), "earthElevSum": round(sum(earth), 1)},
    }
    path = pathlib.Path(__file__).parent / "out" / "long_night.json"
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(out, indent=1))
    print(f"wrote {path}")
    print("checksums:", out["checksums"])
    print("SEP events:", len(out["sep"]), "| strong flares:", len(out["flares"]))


if __name__ == "__main__":
    try:
        main()
    except Exception as e:  # network errors, service changes
        print(f"Pipeline failed: {e}", file=sys.stderr)
        print("The app keeps working: it ships with the record already bundled in src/data/longNight.js.", file=sys.stderr)
        sys.exit(1)
