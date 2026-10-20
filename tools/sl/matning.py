#!/usr/bin/env python3
"""Mäter restiden med buss från Olovslundsskolan till Vällingbyskolan och fem skolor i närområdet
via SL:s öppna reseplanerare (Trafiklab Journey-planner v2, ingen nyckel).

En körning gör en mätning per mål och lägger en rad per mål i en CSV. Körs var 5:e minut av GitHub Actions.
Mätvärdena är SL:s planerade tider med realtidsuppdateringar, inte uppmätta restider, och gäller SL:s ordinarie
busstrafik (inte eventuell egen skolbussning).

  python3 tools/sl/matning.py --ut data/sl_matningar.csv            # bara skoltid vardagar
  python3 tools/sl/matning.py --ut /tmp/test.csv --force            # mät oavsett tid
"""
import argparse, csv, json, os, sys, time, urllib.parse, urllib.request, urllib.error
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

BASE = "https://journeyplanner.integration.sl.se/v2/trips"
UA = {"User-Agent": "olovslund-matning/1.0 (foraldragrupp; kontakt olovslundsskolanforaldrar@gmail.com)", "Accept": "application/json"}
STHLM = ZoneInfo("Europe/Stockholm")

# plats-id och koordinater [lat, lon] från SL:s stop-finder 2026-10-20
PLATSER = {
    "Olovslundsskolan": ("poiID:40001370:33001080:-1:Olovslundsskolan:Stockholm:Olovslundsskolan:ANY:POI:1996876:3747547:MRCV:slt", (59.331815, 17.938242)),
    "Vällingbyskolan": ("poiID:40000879:33001080:-1:Vällingbyskolan:Stockholm:Vällingbyskolan:ANY:POI:1990608:3740617:MRCV:slt", (59.363553, 17.881936)),
    "Abrahamsbergsskolan": ("poiID:40001529:33001080:-1:Abrahamsbergsskolan:Stockholm:Abrahamsbergsskolan:ANY:POI:1998198:3746838:MRCV:slt", (59.335063, 17.950118)),
    "Norra Ängby skola": ("poiID:40001186:33001080:-1:Norra Ängby skola:Stockholm:Norra Ängby skola:ANY:POI:1993557:3743705:MRCV:slt", (59.349414, 17.908427)),
    "Nya Elementar": ("poiID:40001264:33001080:-1:Nya Elementar:Stockholm:Nya Elementar:ANY:POI:1995552:3745198:MRCV:slt", (59.342576, 17.926349)),
    "Äppelviksskolan": ("poiID:40001360:33001080:-1:Äppelviksskolan:Stockholm:Äppelviksskolan:ANY:POI:2001043:3749468:MRCV:slt", (59.323011, 17.975675)),
    "Ålstensskolan": ("poiID:40000593:33001080:-1:Ålstensskolan:Stockholm:Ålstensskolan:ANY:POI:1999018:3748941:MRCV:slt", (59.325427, 17.957484)),
}
ORIGIN = "Olovslundsskolan"
MAL = [k for k in PLATSER if k != ORIGIN]

KOLUMNER = ["tid_utc", "tid_lokal", "veckodag", "mal", "totalt_min_realtid", "totalt_min_planerad", "buss_min", "gang_min",
            "byten", "linjer", "pa_hallplats", "av_hallplats", "avgang_lokal", "ankomst_lokal", "antal_resor", "status"]
VECKODAGAR = ["mån", "tis", "ons", "tors", "fre", "lör", "sön"]


def i_matfonster(lokal):
    """Vardagar 06:30–09:00 och 14:00–17:30 svensk tid."""
    if lokal.weekday() >= 5: return False
    m = lokal.hour * 60 + lokal.minute
    return 6 * 60 + 30 <= m < 9 * 60 or 14 * 60 <= m < 17 * 60 + 30


def plats_param(namn, via_koordinat=False):
    pid, (lat, lon) = PLATSER[namn]
    if via_koordinat:
        return "coord", f"{lon:.5f}:{lat:.5f}:WGS84[dd.ddddd]"
    return "any", pid


def hamta(mal, via_koordinat=False, forsok=2):
    to, nto = plats_param(ORIGIN, via_koordinat)
    td, ntd = plats_param(mal, via_koordinat)
    p = {"type_origin": to, "name_origin": nto, "type_destination": td, "name_destination": ntd,
         "calc_number_of_trips": 3, "language": "sv", "incl_mot_5": "true"}
    url = BASE + "?" + urllib.parse.urlencode(p, safe=":[]|.")
    fel = None
    for n in range(forsok):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25) as r:
                return json.loads(r.read().decode("utf-8")), None
        except urllib.error.HTTPError as e:
            fel = f"HTTP {e.code}: {e.read()[:160].decode('utf-8', 'replace')}"
        except Exception as e:
            fel = repr(e)[:200]
        time.sleep(2)
    return None, fel


def tid(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00")) if s else None


def lokaltid(dt):
    return dt.astimezone(STHLM).strftime("%H:%M:%S") if dt else ""


def sammanfatta(d):
    """Returnerar (rad-dict, status). Väljer den snabbaste av de (högst 3) resor SL föreslår."""
    resor = d.get("journeys") or []
    if not resor:
        msg = "; ".join(str(m.get("text")) for m in d.get("systemMessages", []) if m.get("text"))
        return {}, "inga bussresor" + (f": {msg}" if msg else "")
    def dur(j): return j.get("tripRtDuration") or j.get("tripDuration") or 10 ** 9
    bast = min(resor, key=dur)
    ben = bast.get("legs", [])
    buss = [l for l in ben if (l.get("transportation", {}).get("product", {}) or {}).get("class") == 5]
    gang = [l for l in ben if (l.get("transportation", {}).get("product", {}) or {}).get("class") in (99, 100)]
    linjer = sorted({str(l["transportation"].get("disassembledName") or l["transportation"].get("name")) for l in buss})
    first, last = ben[0], ben[-1]
    dep = tid(first["origin"].get("departureTimeEstimated") or first["origin"].get("departureTimePlanned"))
    arr = tid(last["destination"].get("arrivalTimeEstimated") or last["destination"].get("arrivalTimePlanned"))
    return {
        "totalt_min_realtid": round((bast.get("tripRtDuration") or bast.get("tripDuration")) / 60, 1),
        "totalt_min_planerad": round(bast.get("tripDuration") / 60, 1),
        "buss_min": round(sum(l.get("duration", 0) for l in buss) / 60, 1),
        "gang_min": round(sum(l.get("duration", 0) for l in gang) / 60, 1),
        "byten": bast.get("interchanges"),
        "linjer": "+".join(linjer),
        "pa_hallplats": (buss[0]["origin"].get("name") or "") if buss else "",
        "av_hallplats": (buss[-1]["destination"].get("name") or "") if buss else "",
        "avgang_lokal": lokaltid(dep), "ankomst_lokal": lokaltid(arr),
        "antal_resor": len(resor),
    }, "ok"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ut", required=True, help="CSV som raderna läggs till i")
    ap.add_argument("--force", action="store_true", help="mät även utanför skoltid")
    ap.add_argument("--koordinater", action="store_true", help="använd koordinater i stället för plats-id (test)")
    a = ap.parse_args()
    nu = datetime.now(timezone.utc)
    lokal = nu.astimezone(STHLM)
    if not a.force and not i_matfonster(lokal):
        print(f"{lokal:%Y-%m-%d %H:%M} (svensk tid) ligger utanför mätfönstret, hoppar över."); return 0
    os.makedirs(os.path.dirname(os.path.abspath(a.ut)), exist_ok=True)
    ny = not os.path.exists(a.ut) or os.path.getsize(a.ut) == 0
    rader = []
    for mal in MAL:
        d, fel = hamta(mal, a.koordinater)
        if d is None:
            rad, status = {}, f"fel: {fel}"
        else:
            try:
                rad, status = sammanfatta(d)
            except Exception as e:  # oväntat svar ska synas i datan, inte stoppa mätningen
                rad, status = {}, f"tolkningsfel: {e!r}"[:200]
        rad.update(tid_utc=nu.strftime("%Y-%m-%dT%H:%M:%SZ"), tid_lokal=lokal.strftime("%Y-%m-%d %H:%M:%S"),
                   veckodag=VECKODAGAR[lokal.weekday()], mal=mal, status=status)
        rader.append(rad)
        print(f"{mal:22s} {status:10s} totalt {rad.get('totalt_min_realtid', '-')} min, buss {rad.get('buss_min', '-')} min, "
              f"gång {rad.get('gang_min', '-')} min, linje {rad.get('linjer', '-')}")
    with open(a.ut, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=KOLUMNER, extrasaction="ignore")
        if ny: w.writeheader()
        w.writerows(rader)
    return 0


if __name__ == "__main__":
    sys.exit(main())
