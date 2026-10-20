"""Utforskar SL:s reseplanerare (Trafiklab Journey-planner v2) från GitHub-runnern.
Skriver råsvar till loggen så att mätskriptet kan byggas på verkliga fältnamn."""
import json, sys, urllib.parse, urllib.request, urllib.error

BASE = "https://journeyplanner.integration.sl.se/v2"
UA = {"User-Agent": "olovslund-matning/0.1 (foraldragrupp; kontakt olovslundsskolanforaldrar@gmail.com)", "Accept": "application/json"}


def get(path, params, show=1500):
    url = f"{BASE}/{path}?" + urllib.parse.urlencode(params, safe=":[]|.")
    print("\n>>> GET", url)
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
            body = r.read().decode("utf-8")
            print("HTTP", r.status, r.headers.get("content-type"), len(body), "byte")
    except urllib.error.HTTPError as e:
        print("HTTP-fel", e.code, e.read()[:600])
        return None
    except Exception as e:
        print("Fel", repr(e)); return None
    try:
        data = json.loads(body)
    except Exception:
        print(body[:show]); return None
    return data


NAMES = ["Olovslundsskolan", "Penninglandet 2, Bromma", "Vällingbyskolan", "Abrahamsbergsskolan", "Norra Ängby skola",
         "Nya Elementar", "Äppelviksskolan", "Ålstensskolan", "Åkeshovsvägen 7, Bromma"]
for nm in NAMES:
    for flt in ("46", None):
        p = {"name_sf": nm, "type_sf": "any"}
        if flt: p["any_obj_filter_sf"] = flt
        d = get("stop-finder", p)
        if not d: continue
        locs = d.get("locations") or d.get("stopFinder", {}).get("points") or []
        print(f"  [{nm}] filter={flt}: {len(locs)} träffar; nycklar: {list(d.keys())}")
        for l in locs[:5]:
            print("   ", json.dumps({k: l.get(k) for k in ("id", "name", "disassembledName", "type", "coord", "isBest", "matchQuality")}, ensure_ascii=False))

# en rå resa som exempel
d = get("trips", {"type_origin": "any", "name_origin": "Olovslundsskolan", "type_destination": "any", "name_destination": "Vällingbyskolan",
                  "calc_number_of_trips": 3, "language": "sv"}, show=3000)
if d:
    print(json.dumps(d, ensure_ascii=False)[:7000])
    for j in d.get("journeys", []):
        legs = j.get("legs", [])
        print("RESA", j.get("tripDuration"), "s,", len(legs), "ben:",
              [(l.get("transportation", {}).get("product", {}).get("name"), l.get("transportation", {}).get("disassembledName"), l.get("duration")) for l in legs])
