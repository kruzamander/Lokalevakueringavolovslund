"""Utforskar SL:s reseplanerare (Trafiklab Journey-planner v2) från GitHub-runnern, del 2: resor."""
import json, urllib.parse, urllib.request, urllib.error

BASE = "https://journeyplanner.integration.sl.se/v2"
UA = {"User-Agent": "olovslund-matning/0.1 (foraldragrupp; kontakt olovslundsskolanforaldrar@gmail.com)", "Accept": "application/json"}
POI = {
    "Olovslundsskolan": "poiID:40001370:33001080:-1:Olovslundsskolan:Stockholm:Olovslundsskolan:ANY:POI:1996876:3747547:MRCV:slt",
    "Vällingbyskolan": "poiID:40000879:33001080:-1:Vällingbyskolan:Stockholm:Vällingbyskolan:ANY:POI:1990608:3740617:MRCV:slt",
    "Abrahamsbergsskolan": "poiID:40001529:33001080:-1:Abrahamsbergsskolan:Stockholm:Abrahamsbergsskolan:ANY:POI:1998198:3746838:MRCV:slt",
    "Norra Ängby skola": "poiID:40001186:33001080:-1:Norra Ängby skola:Stockholm:Norra Ängby skola:ANY:POI:1993557:3743705:MRCV:slt",
}


def get(path, params):
    url = f"{BASE}/{path}?" + urllib.parse.urlencode(params, safe=":[]|.")
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
            return json.loads(r.read().decode("utf-8")), url
    except urllib.error.HTTPError as e:
        return {"HTTPFEL": e.code, "body": e.read()[:500].decode("utf-8", "replace")}, url
    except Exception as e:
        return {"FEL": repr(e)}, url


def summarize(d):
    if "journeys" not in d:
        return json.dumps(d, ensure_ascii=False)[:600]
    out = []
    for j in d["journeys"]:
        legs = []
        for l in j.get("legs", []):
            t = l.get("transportation", {}) or {}
            pr = t.get("product", {}) or {}
            legs.append(f'{pr.get("class")}/{pr.get("name")}/{t.get("disassembledName") or t.get("name")}:{l.get("duration")}s')
        out.append(f'  tripDuration={j.get("tripDuration")} tripRtDuration={j.get("tripRtDuration")} byten={j.get("interchanges")} :: ' + " | ".join(legs))
    return "\n".join(out)


o = POI["Olovslundsskolan"]
# 1) rå struktur för en resa
d, url = get("trips", {"type_origin": "any", "name_origin": o, "type_destination": "any", "name_destination": POI["Vällingbyskolan"],
                       "calc_number_of_trips": 3, "language": "sv"})
print(">>>", url)
print("nycklar:", list(d.keys()))
if d.get("journeys"):
    print(json.dumps(d["journeys"][0], ensure_ascii=False)[:5500])
print(summarize(d))

# 2) varianter för att få bara buss
variants = {
    "grund": {},
    "incl_mot_5": {"incl_mot_5": "true"},
    "inclMOT_5": {"inclMOT_5": "true"},
    "excl_mot": {"excl_mot_1": "true", "excl_mot_2": "true", "excl_mot_3": "true", "excl_mot_4": "true"},
    "excludedMeans": {"excluded_means": "checkbox", "excl_mot_1": "1", "excl_mot_2": "1", "excl_mot_4": "1"},
    "leasttime": {"route_type": "leasttime"},
}
for name, extra in variants.items():
    p = {"type_origin": "any", "name_origin": o, "type_destination": "any", "name_destination": POI["Vällingbyskolan"], "calc_number_of_trips": 5, "language": "sv"}
    p.update(extra)
    d, url = get("trips", p)
    print(f"\n### variant {name}: {url[-160:]}")
    print(summarize(d))

# 3) övriga mål med grundparametrar
for nm in ("Abrahamsbergsskolan", "Norra Ängby skola"):
    d, url = get("trips", {"type_origin": "any", "name_origin": o, "type_destination": "any", "name_destination": POI[nm], "calc_number_of_trips": 3, "language": "sv"})
    print(f"\n### mål {nm}")
    print(summarize(d))
