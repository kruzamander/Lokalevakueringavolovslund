#!/usr/bin/env python3
"""Mäter restiden med buss från Olovslundsskolan till Vällingbyskolan och fem skolor i närområdet
via SL:s öppna reseplanerare (Trafiklab Journey-planner v2, ingen nyckel).

En körning gör en mätning per mål och lägger en rad per mål i en CSV. Körs av GitHub Actions under skoltid.
Mätvärdena är SL:s planerade tider med realtidsuppdateringar, inte uppmätta restider, och gäller SL:s ordinarie
busstrafik (inte eventuell egen skolbussning).

  python3 tools/sl/matning.py --ut data/sl_matningar.csv            # bara skoltid vardagar
  python3 tools/sl/matning.py --ut /tmp/test.csv --force            # mät oavsett tid

Slutkod: 0 = klart (felrader sparas som data), 3 = alla mätningar i körningen misslyckades.
"""
import argparse, csv, json, os, re, sys, time, urllib.parse, urllib.request, urllib.error
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

BASE = "https://journeyplanner.integration.sl.se/v2/trips"
UA = {"User-Agent": "olovslund-matning/1.0 (foraldragrupp; kontakt olovslundsskolanforaldrar@gmail.com)", "Accept": "application/json"}
STHLM = ZoneInfo("Europe/Stockholm")
TIMEOUT = 20          # sekunder per anrop
MAX_SVAR = 5_000_000  # byte; SL:s svar är normalt ett par hundra kB

# plats-id från SL:s stop-finder 2026-10-20
PLATSER = {
    "Olovslundsskolan": "poiID:40001370:33001080:-1:Olovslundsskolan:Stockholm:Olovslundsskolan:ANY:POI:1996876:3747547:MRCV:slt",
    "Vällingbyskolan": "poiID:40000879:33001080:-1:Vällingbyskolan:Stockholm:Vällingbyskolan:ANY:POI:1990608:3740617:MRCV:slt",
    "Abrahamsbergsskolan": "poiID:40001529:33001080:-1:Abrahamsbergsskolan:Stockholm:Abrahamsbergsskolan:ANY:POI:1998198:3746838:MRCV:slt",
    "Norra Ängby skola": "poiID:40001186:33001080:-1:Norra Ängby skola:Stockholm:Norra Ängby skola:ANY:POI:1993557:3743705:MRCV:slt",
    "Nya Elementar": "poiID:40001264:33001080:-1:Nya Elementar:Stockholm:Nya Elementar:ANY:POI:1995552:3745198:MRCV:slt",
    "Äppelviksskolan": "poiID:40001360:33001080:-1:Äppelviksskolan:Stockholm:Äppelviksskolan:ANY:POI:2001043:3749468:MRCV:slt",
    "Ålstensskolan": "poiID:40000593:33001080:-1:Ålstensskolan:Stockholm:Ålstensskolan:ANY:POI:1999018:3748941:MRCV:slt",
}
ORIGIN = "Olovslundsskolan"
MAL = [k for k in PLATSER if k != ORIGIN]

KOLUMNER = ["tid_utc", "tid_lokal", "veckodag", "mal", "totalt_min_realtid", "totalt_min_planerad", "buss_min", "gang_min",
            "ovrigt_min", "till_avgang_min", "byten", "linjer", "pa_hallplats", "av_hallplats", "avgang_lokal", "ankomst_lokal",
            "antal_resor", "status"]
VECKODAGAR = ["mån", "tis", "ons", "tors", "fre", "lör", "sön"]
BUSS, GANG = {5}, {99, 100}   # SL:s produktklasser: 5 = buss, 99/100 = gångväg


def i_matfonster(lokal):
    """Vardagar 06:30–09:00 och 14:00–17:30 svensk tid."""
    if lokal.weekday() >= 5: return False
    m = lokal.hour * 60 + lokal.minute
    return 6 * 60 + 30 <= m < 9 * 60 or 14 * 60 <= m < 17 * 60 + 30


def hamta(mal, forsok=2):
    """Ett anrop till SL. Returnerar (json, None) eller (None, felbeskrivning)."""
    p = {"type_origin": "any", "name_origin": PLATSER[ORIGIN], "type_destination": "any", "name_destination": PLATSER[mal],
         "calc_number_of_trips": 3, "language": "sv", "incl_mot_5": "true"}
    url = BASE + "?" + urllib.parse.urlencode(p, safe=":[]|.")
    fel = None
    for n in range(forsok):
        if n: time.sleep(2)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=TIMEOUT) as r:
                return json.loads(r.read(MAX_SVAR).decode("utf-8")), None
        except urllib.error.HTTPError as e:
            fel = f"HTTP {e.code}: {e.read()[:160].decode('utf-8', 'replace')}"
            if e.code < 500 and e.code not in (408, 429): break   # övriga 4xx: nytt försök ger samma svar
        except Exception as e:
            fel = repr(e)[:200]
    return None, fel


def text(s):
    """Text från SL blir en CSV-cell: en rad, och inget som ett kalkylprogram kan tolka som formel."""
    s = re.sub(r"\s+", " ", str(s if s is not None else "")).strip()
    return "'" + s if s[:1] in ("=", "+", "-", "@") else s


def tid(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00")) if s else None


def lokaltid(dt):
    return dt.astimezone(STHLM).strftime("%H:%M:%S") if dt else ""


def sek(resa, nyckel):
    v = resa.get(nyckel)
    return v if isinstance(v, (int, float)) and v > 0 else None


def realtid(resa):
    """Restid i sekunder: realtidsprognosen om SL har en, annars tidtabellen."""
    return sek(resa, "tripRtDuration") or sek(resa, "tripDuration")


def min1(sekunder):
    return round(sekunder / 60, 1) if sekunder is not None else ""


def ben_info(ben):
    t = ben.get("transportation") or {}
    return t, (t.get("product") or {}).get("class")


def sammanfatta(d, nu):
    """Returnerar (rad-dict, status). Väljer den snabbaste av de (högst 3) resor SL föreslår."""
    resor = d.get("journeys") or []
    if not resor:
        msg = "; ".join(str(m.get("text")) for m in d.get("systemMessages") or [] if m.get("text"))
        return {}, "inga bussresor" + (f": {msg}" if msg else "")
    med_tid = [j for j in resor if realtid(j)]
    if not med_tid:
        return {}, "tolkningsfel: ingen resa har restid"
    bast = min(med_tid, key=realtid)
    ben = bast.get("legs") or []
    if not ben:
        return {}, "tolkningsfel: resan saknar delsträckor"
    buss = [l for l in ben if ben_info(l)[1] in BUSS]
    gang = [l for l in ben if ben_info(l)[1] in GANG]
    ovriga = sorted({str(ben_info(l)[1]) for l in ben} - {str(k) for k in BUSS | GANG})
    linjer = sorted({str(ben_info(l)[0].get("disassembledName") or ben_info(l)[0].get("name") or "?") for l in buss})
    forst, sist = ben[0], ben[-1]
    dep = tid((forst.get("origin") or {}).get("departureTimeEstimated") or (forst.get("origin") or {}).get("departureTimePlanned"))
    arr = tid((sist.get("destination") or {}).get("arrivalTimeEstimated") or (sist.get("destination") or {}).get("arrivalTimePlanned"))
    tot, buss_s, gang_s = realtid(bast), sum(l.get("duration") or 0 for l in buss), sum(l.get("duration") or 0 for l in gang)
    return {
        "totalt_min_realtid": min1(tot),
        "totalt_min_planerad": min1(sek(bast, "tripDuration")),
        "buss_min": min1(buss_s),
        "gang_min": min1(gang_s),
        "ovrigt_min": min1(max(tot - buss_s - gang_s, 0)),   # väntan vid byten och sådant som varken är buss eller gång
        "till_avgang_min": min1((dep - nu).total_seconds()) if dep else "",
        "byten": bast.get("interchanges"),
        "linjer": text("+".join(linjer)),
        "pa_hallplats": text((buss[0].get("origin") or {}).get("name")) if buss else "",
        "av_hallplats": text((buss[-1].get("destination") or {}).get("name")) if buss else "",
        "avgang_lokal": lokaltid(dep), "ankomst_lokal": lokaltid(arr),
        "antal_resor": len(resor),
    }, "ok" + (f" (oväntad färdklass: {', '.join(ovriga)})" if ovriga else "")


def forbered_fil(sokvag, nu):
    """True om rubrikraden ska skrivas. En befintlig fil med andra kolumner flyttas undan, så att scheman aldrig blandas."""
    if not os.path.exists(sokvag) or os.path.getsize(sokvag) == 0: return True
    with open(sokvag, newline="", encoding="utf-8") as f:
        rubrik = next(csv.reader(f), [])
    if rubrik == KOLUMNER: return False
    rot, andelse = os.path.splitext(sokvag)
    gammal = f"{rot}.gammalt-schema-{nu:%Y%m%dT%H%M%SZ}{andelse}"
    os.replace(sokvag, gammal)
    print(f"Kolumnerna i {sokvag} stämmer inte med skriptet. Den gamla filen sparades som {gammal}.", file=sys.stderr)
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ut", required=True, help="CSV som raderna läggs till i")
    ap.add_argument("--force", action="store_true", help="mät även utanför skoltid")
    a = ap.parse_args()
    nu = datetime.now(timezone.utc)
    lokal = nu.astimezone(STHLM)
    if not a.force and not i_matfonster(lokal):
        print(f"{lokal:%Y-%m-%d %H:%M} (svensk tid) ligger utanför mätfönstret, hoppar över."); return 0
    os.makedirs(os.path.dirname(os.path.abspath(a.ut)), exist_ok=True)
    skriv_rubrik = forbered_fil(a.ut, nu)
    with ThreadPoolExecutor(max_workers=len(MAL)) as pool:     # alla mål samtidigt: samma tidpunkt och en kort körning
        svar = list(pool.map(hamta, MAL))
    rader = []
    for mal, (d, fel) in zip(MAL, svar):
        if d is None:
            rad, status = {}, f"fel: {fel}"
        else:
            try:
                rad, status = sammanfatta(d, nu)
            except Exception as e:  # oväntat svar ska synas i datan, inte stoppa mätningen
                rad, status = {}, f"tolkningsfel: {e!r}"
        rad.update(tid_utc=nu.strftime("%Y-%m-%dT%H:%M:%SZ"), tid_lokal=lokal.strftime("%Y-%m-%d %H:%M:%S"),
                   veckodag=VECKODAGAR[lokal.weekday()], mal=mal, status=text(status)[:200])
        rader.append(rad)
        print(f"{mal:22s} {rad['status'][:30]:30s} totalt {rad.get('totalt_min_realtid', '-')} min, buss {rad.get('buss_min', '-')} min, "
              f"gång {rad.get('gang_min', '-')} min, linje {rad.get('linjer', '-')}")
    with open(a.ut, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=KOLUMNER, extrasaction="ignore")
        if skriv_rubrik: w.writeheader()
        w.writerows(rader)
    if all(r["status"].startswith(("fel", "tolkningsfel")) for r in rader):
        print("Alla mätningar i den här körningen misslyckades. Raderna är sparade med status.", file=sys.stderr)
        return 3
    return 0


if __name__ == "__main__":
    sys.exit(main())
