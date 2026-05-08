#!/usr/bin/env python3
"""
AETHER POI Database Builder
============================
Downloads hospital, police, and service data from OpenStreetMap
and builds a SQLite database bundled in the app.

WHY OPENSTREETMAP?
- Free, open, global coverage (195+ countries)
- Updated daily by millions of volunteers
- Contains phone numbers, capabilities, hours for hospitals
- No API key needed for bulk exports

HOW THIS SCRIPT WORKS:
1. Uses the Overpass API (OSM's query interface) to fetch POIs
2. Parses the JSON response into a clean format
3. Inserts into SQLite using the same schema as POIDatabase.ts
4. Outputs aether_poi.db to the assets folder

USAGE:
  python scripts/build_poi_db.py --country IN --output assets/data/

ARGUMENTS:
  --country   ISO country code (IN=India, US=USA, etc.) Default: IN
  --bbox      Bounding box: "minLat,minLng,maxLat,maxLng" (overrides country)
  --output    Output directory for the .db file
  --verbose   Print each POI as it's inserted
"""

import json
import sqlite3
import time
import argparse
import os
import sys
from pathlib import Path

try:
    import requests
except ImportError:
    print("ERROR: 'requests' not installed. Run: pip install requests")
    sys.exit(1)

# ─── Overpass API Query Templates ─────────────────────────────────────────────

OVERPASS_URL = "https://overpass-api.de/api/interpreter"

# Bounding boxes for common BIMSTEC countries
COUNTRY_BBOX = {
    "IN": "8.0,68.0,37.0,98.0",     # India
    "BD": "20.6,88.0,26.6,92.7",    # Bangladesh
    "NP": "26.3,80.0,30.5,88.2",    # Nepal
    "LK": "5.9,79.7,9.8,81.9",      # Sri Lanka
    "MM": "9.8,92.2,28.5,101.2",    # Myanmar
    "TH": "5.6,97.3,20.5,105.7",    # Thailand
    "BT": "26.7,88.8,28.3,92.1",    # Bhutan
}

def build_overpass_query(bbox: str) -> str:
    """
    Build an Overpass QL query to fetch all relevant POI types.

    Overpass QL is the query language for OpenStreetMap data.
    We fetch: hospitals, clinics, police stations, towing services,
              tyre shops, petrol stations, blood banks.
    """
    return f"""
[out:json][timeout:120][bbox:{bbox}];
(
  // Hospitals and medical facilities
  node["amenity"="hospital"];
  way["amenity"="hospital"];
  relation["amenity"="hospital"];

  node["amenity"="clinic"];
  way["amenity"="clinic"];

  // Police stations
  node["amenity"="police"];
  way["amenity"="police"];

  // Towing services
  node["service:vehicle:towing"="yes"];
  way["service:vehicle:towing"="yes"];
  node["amenity"="vehicle_inspection"]["towing"="yes"];

  // Tyre/puncture shops
  node["shop"="tyres"];
  way["shop"="tyres"];
  node["shop"="car_repair"]["service:tyres"="yes"];

  // Petrol stations
  node["amenity"="fuel"];
  way["amenity"="fuel"];

  // Blood banks
  node["amenity"="blood_bank"];
  way["amenity"="blood_bank"];
);
out body center;
"""


def determine_poi_type(tags: dict) -> str:
    """Map OSM tags to AETHER POI types."""
    amenity = tags.get("amenity", "")
    shop = tags.get("shop", "")
    service = tags.get("service:vehicle:towing", "")

    if amenity in ("hospital", "clinic"):
        return "hospital"
    elif amenity == "police":
        return "police"
    elif amenity == "fuel":
        return "petrol"
    elif amenity == "blood_bank":
        return "blood_bank"
    elif shop == "tyres" or tags.get("service:tyres") == "yes":
        return "puncture"
    elif service == "yes" or amenity == "vehicle_inspection":
        return "towing"
    return "unknown"


def extract_capabilities(tags: dict) -> list:
    """
    Extract hospital capabilities from OSM tags.
    These map directly to what Phase 6 (Hospital Pre-Alert) uses for matching.
    """
    capabilities = []

    # Check for specific specialties in OSM tags
    healthcare_speciality = tags.get("healthcare:speciality", "")
    if "neurology" in healthcare_speciality or "neurosurgery" in healthcare_speciality:
        capabilities.append("neurosurgery")

    if tags.get("emergency") == "yes":
        capabilities.append("emergency")

    if tags.get("healthcare:blood_bank") == "yes" or tags.get("blood_bank") == "yes":
        capabilities.append("blood_bank")

    if "paediatric" in healthcare_speciality or "pediatric" in healthcare_speciality:
        capabilities.append("paediatric_icu")

    if "cardiology" in healthcare_speciality:
        capabilities.append("cath_lab")

    if "burn" in healthcare_speciality:
        capabilities.append("burn_unit")

    # Beds count as ICU indicator if > 100
    beds = tags.get("beds", "0")
    try:
        if int(beds) > 100:
            capabilities.append("ventilator")
    except (ValueError, TypeError):
        pass

    return capabilities


def get_coordinates(element: dict) -> tuple:
    """Extract lat/lng from OSM element (nodes have direct coords, ways have 'center')."""
    if element["type"] == "node":
        return element.get("lat"), element.get("lon")
    elif "center" in element:
        return element["center"]["lat"], element["center"]["lon"]
    return None, None


def fetch_osm_data(bbox: str, verbose: bool = False) -> list:
    """Fetch POI data from Overpass API."""
    query = build_overpass_query(bbox)

    print(f"Fetching OSM data for bbox: {bbox}")
    print("This may take 1-3 minutes for large areas...")

    try:
        response = requests.post(
            OVERPASS_URL,
            data={"data": query},
            timeout=180,
            headers={"User-Agent": "AETHER-RoadSafety/1.0 (bimstec-hackathon@example.com)"}
        )
        response.raise_for_status()
        data = response.json()
        elements = data.get("elements", [])
        print(f"Fetched {len(elements)} raw OSM elements")
        return elements

    except requests.exceptions.Timeout:
        print("ERROR: Overpass API timed out. Try a smaller bbox.")
        sys.exit(1)
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Failed to fetch from Overpass: {e}")
        sys.exit(1)


def build_database(elements: list, output_path: str, country_code: str, verbose: bool = False):
    """Build SQLite database from OSM elements."""
    db_path = os.path.join(output_path, "aether_poi.db")

    # Remove existing DB so we start fresh
    if os.path.exists(db_path):
        os.remove(db_path)
        print(f"Removed existing database at {db_path}")

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # Create table — same schema as POIDatabase.ts
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS poi (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            phone TEXT,
            hours TEXT,
            capabilities TEXT DEFAULT '[]',
            country_code TEXT DEFAULT 'XX',
            confidence REAL DEFAULT 1.0
        )
    """)

    cursor.execute("CREATE INDEX IF NOT EXISTS idx_poi_type ON poi(type)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_poi_location ON poi(lat, lng)")

    inserted = 0
    skipped = 0

    for element in elements:
        tags = element.get("tags", {})
        lat, lng = get_coordinates(element)

        if lat is None or lng is None:
            skipped += 1
            continue

        poi_type = determine_poi_type(tags)
        if poi_type == "unknown":
            skipped += 1
            continue

        # Get name — try multiple OSM name tags
        name = (
            tags.get("name:en") or
            tags.get("name") or
            tags.get("official_name") or
            f"Unnamed {poi_type.title()}"
        )

        # Clean name — remove weird characters
        name = name.strip()
        if not name:
            skipped += 1
            continue

        poi_id = f"osm_{element['type'][0]}_{element['id']}"
        phone = tags.get("phone") or tags.get("contact:phone") or tags.get("contact:mobile")
        hours = tags.get("opening_hours")
        capabilities = extract_capabilities(tags)

        # Confidence: named + has phone = 0.9, just named = 0.7, unnamed = 0.5
        confidence = 0.9 if phone else (0.7 if tags.get("name") else 0.5)

        try:
            cursor.execute(
                """INSERT OR IGNORE INTO poi
                   (id, type, name, lat, lng, phone, hours, capabilities, country_code, confidence)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    poi_id,
                    poi_type,
                    name,
                    lat,
                    lng,
                    phone,
                    hours,
                    json.dumps(capabilities),
                    country_code,
                    confidence,
                )
            )
            inserted += 1

            if verbose:
                print(f"  [{poi_type.upper():<10}] {name[:50]:<50} ({lat:.4f}, {lng:.4f})")

        except sqlite3.Error as e:
            print(f"  DB error for {poi_id}: {e}")

    conn.commit()

    # Print summary
    cursor.execute("SELECT type, COUNT(*) FROM poi GROUP BY type")
    counts = cursor.fetchall()

    print("\n" + "=" * 50)
    print(f"DATABASE BUILT: {db_path}")
    print(f"Total inserted: {inserted} | Skipped: {skipped}")
    print("\nBreakdown by type:")
    for type_name, count in counts:
        print(f"  {type_name:<15}: {count:>5}")
    print("=" * 50)

    file_size_mb = os.path.getsize(db_path) / (1024 * 1024)
    print(f"File size: {file_size_mb:.2f} MB")

    conn.close()
    return db_path


def main():
    parser = argparse.ArgumentParser(description="Build AETHER POI SQLite database from OpenStreetMap")
    parser.add_argument(
        "--country",
        default="IN",
        choices=list(COUNTRY_BBOX.keys()),
        help="Country code to fetch data for (default: IN)"
    )
    parser.add_argument(
        "--bbox",
        help="Custom bounding box: 'minLat,minLng,maxLat,maxLng' (overrides --country)"
    )
    parser.add_argument(
        "--output",
        default="assets/data",
        help="Output directory for the .db file (default: assets/data)"
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print each POI as it's inserted"
    )

    args = parser.parse_args()

    # Determine bounding box
    bbox = args.bbox or COUNTRY_BBOX.get(args.country)
    if not bbox:
        print(f"ERROR: Unknown country '{args.country}'. Use --bbox for custom area.")
        sys.exit(1)

    # Ensure output directory exists
    Path(args.output).mkdir(parents=True, exist_ok=True)

    print("=" * 50)
    print("AETHER POI Database Builder")
    print(f"Country: {args.country} | Bbox: {bbox}")
    print("=" * 50)

    # Fetch and build
    start_time = time.time()
    elements = fetch_osm_data(bbox, args.verbose)
    db_path = build_database(elements, args.output, args.country, args.verbose)

    elapsed = time.time() - start_time
    print(f"\nCompleted in {elapsed:.1f} seconds")
    print(f"\nNext step: Copy {db_path} to your app's assets and run the app.")


if __name__ == "__main__":
    main()
