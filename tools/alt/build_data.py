#!/usr/bin/env python3
"""Genererar site/alternativ/data.js till presentationen av föräldragruppens 14 alternativ.

Tal kommer från alt_calc.json (omräknade från förvaltningens elevprognoser och kapacitet, kontrollerade mot arbetsbladet).
Texterna är samma som i PDF:en 'Alternativ till evakuering av Olovslundsskolan' (utkast 3).

  python3 tools/alt/build_data.py
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "site", "alternativ", "data.js")
D = json.load(open(os.path.join(HERE, "alt_calc.json"), encoding="utf-8"))
BENCH, OL, PROG = D["BENCH"], {int(y): v for y, v in D["OL"].items()}, {k: {int(y): v for y, v in d.items()} for k, d in D["prog"].items()}
NB = " "

# Koordinater [lat, lon] från SL:s platsuppslag 2026-10-20. Stadsdelsområde enligt stadens indelning (inte beräknat från gränsdata).
SCHOOLS = {
    "OL": dict(name="Olovslundsskolan", short="Olovslund", lat=59.331815, lon=17.938242, district="Bromma"),
    "ABA": dict(name="Abrahamsbergsskolan", short="Abrahamsberg", lat=59.335063, lon=17.950118, district="Bromma", cap=780),
    "NA": dict(name="Norra Ängby skola", short="Norra Ängby", lat=59.349414, lon=17.908427, district="Bromma", cap=784),
    "NE": dict(name="Nya Elementar", short="Nya Elementar", lat=59.342576, lon=17.926349, district="Bromma", cap=1068),
    "AV": dict(name="Äppelviksskolan", short="Äppelviken", lat=59.323011, lon=17.975675, district="Bromma", cap=680),
    "AL": dict(name="Ålstensskolan", short="Ålsten", lat=59.325427, lon=17.957484, district="Bromma", cap=476),
    "VAL": dict(name="Vällingbyskolan", short="Vällingby", lat=59.363553, lon=17.881936, district="Hässelby-Vällingby", cap=1050),
    "PAV": dict(name="Paviljong Åkeshovsvägen 7", short="Paviljong Åkeshovsvägen 7", district="Bromma", cap=240),
}
KEY = {"Abrahamsbergsskolan": "ABA", "Norra Ängby skola": "NA", "Nya Elementar": "NE", "Ålstensskolan": "AL", "Äppelviksskolan": "AV",
       "Paviljong Åkeshovsvägen 7": "PAV"}
ANP = {2028: "Stängs 2028", 2030: "Utom åk 1–2", 2032: "Fasas ut"}
WIN = {2028: "2028–2030", 2030: "2030–2032", 2032: "2032–2034"}
SUB = {2028: "Evakuering ht 2028 – vt 2030", 2030: "Renoveringen skjuts två år", 2032: "Renoveringen skjuts fyra år"}
SPECIAL = {3, 4, 8, 9, 10}
VAR2 = "Två möjliga varianter: F–3 Abrahamsberg och åk 4–6 Nya Elementar, eller åk 3–6 Abrahamsberg och F–2 Nya Elementar."


def pct(x, d=1):
    return f"{x * 100:.{d}f}".replace(".", ",") + NB + "%"


def pp(x):
    return f"{x:+.1f}".replace(".", ",").replace("-", "−") + NB + "pp"


def num(n):
    return f"{int(round(n)):,}".replace(",", NB)


def place_text(r):
    nr = r["nr"]
    if nr in (1, 5):
        return "År 1: F–2 Norra Ängby, åk 3–6 Abrahamsberg. År 2: F–3 Norra Ängby, åk 4–6 Abrahamsberg."
    if nr in (2, 6, 11):
        return VAR2
    if nr == 12:
        y = r["years"][str(r["start"])]
        ab, al = y["skolor"]
        mx = max((ab["ord"] + 5 * y["per_ak"]) / ab["kap"], (al["ord"] + 2 * y["per_ak"]) / al["kap"])
        return (f"Abrahamsberg 4 årskurser och Ålsten 3. Med Ålsten 2 och Abrahamsberg 5 blir högsta beläggningen {pct(mx)} "
                f"({pp((mx - BENCH) * 100)} mot nivån), alltså något högre.")
    names = {"ABA": "Abrahamsberg", "NA": "Norra Ängby", "NE": "Nya Elementar", "AV": "Äppelviken", "AL": "Ålsten", "PAV": "Paviljong"}
    y = r["years"][str(r["start"])]
    return " · ".join(f'{names[KEY[s["skola"]]]}: {s["ak"]} årskurser' for s in y["skolor"]) + "."


alts = []
for r in D["alts"]:
    y1 = r["years"][str(r["start"])]
    keys = [KEY[s["skola"]] for s in y1["skolor"]]
    names = [("Paviljong Åkeshovsvägen 7" if k == "PAV" else SCHOOLS[k]["short"]) for k in keys]
    years = []
    for i in (0, 1):
        yy = r["years"][str(r["start"] + i)]
        years.append(dict(label=f"ht {r['start'] + i}", ol=yy["ol"], per_ak=yy["per_ak"], schools=[
            dict(s=KEY[s["skola"]], kap=s["kap"], ord=s["ord"], ak=s["ak"], evak=s["evak"], tot=s["ord"] + s["evak"], bel=s["bel"])
            for s in yy["skolor"]]))
    alts.append(dict(
        nr=r["nr"], start=r["start"], window=WIN[r["start"]], sub=SUB[r["start"]], title=" + ".join(names), schools=keys,
        pill=f"{len(keys)} lokaler", behov=y1["behov"], years=years, max_bel=r["max_bel"], diff_pp=(r["max_bel"] - BENCH) * 100,
        over=r["max_bel"] > BENCH + 1e-9, place=place_text(r), anp=ANP[r["start"]],
        special=r["nr"] in SPECIAL, corrected=bool(y1.get("korrigerad"))))

# Diagram: ordinarie elever ÷ kapacitet 2028–2033 (utan evakuering)
chart = []
for k, nm, cap in (("NE", "Nya Elementar", 1068), ("NA", "Norra Ängby skola", 784), ("AV", "Äppelviksskolan", 680), ("AL", "Ålstensskolan", 476),
                   ("ABA", "Abrahamsbergsskolan", 780)):
    ser = [PROG[nm][y] / cap for y in range(2028, 2034)]
    free = 1 - ser[-1]
    stars = 5 if free >= .40 else 4 if free >= .30 else 3 if free >= .20 else 2 if free >= .10 else 1
    chart.append(dict(s=k, series=ser, end=ser[-1], free=free, stars=stars))
av = PROG["Äppelviksskolan"]
vall_ord = PROG["Vällingbyskolan"][2028]
ev_vall, ev_als = OL[2028] / 7 * 5, OL[2028] / 7 * 2
vall_bel = (vall_ord + ev_vall) / 1050
best = {w: min((a for a in alts if a["start"] == w), key=lambda a: a["max_bel"]) for w in (2028, 2030, 2032)}
lowest = {w: dict(pct=best[w]["max_bel"], alts=[a["nr"] for a in alts if a["start"] == w and abs(a["max_bel"] - best[w]["max_bel"]) < 1e-9]) for w in best}
n28, n30, n32 = (sum(1 for a in alts if a["start"] == w) for w in (2028, 2030, 2032))

T = dict(
    cover=dict(kicker=f"Underlag till Utbildningsnämnden · Uppdaterad 2026-10-25", title="Alternativ till evakuering av Olovslundsskolan",
               by="Framtaget av föräldragruppen på Olovslundsskolan", tag="Beslutsunderlag · Utkast"),
    ask=dict(
        h1="Utred fler alternativ innan beslutet i december",
        lead="Förvaltningen har analyserat ett alternativ för evakueringen 2028–2030. Föräldragruppen har med förvaltningens egna elevprognoser och "
             "kapacitetssiffror prövat 14 alternativ: fyra för 2028–2030 och tio om renoveringen förskjuts.",
        asks=[("Utred de lokala alternativen för 2028–2030.", "Samma analys som förvaltningen gjort av sitt eget förslag: elevtal, platser, beläggning, kostnad och påverkan på barnen."),
              ("Redovisa alla alternativ i samma tabell,", "så att nämnden kan jämföra på lika villkor och se vilka som ligger under förvaltningens egen beläggningsnivå."),
              ("Pröva en förskjutning av renoveringen", "till 2030–2032 eller 2032–2034. Det ger fler alternativ och låter den anpassade grundskolan fasas ut: vid 2032–2034 utan att något barn "
               "blir utan skolplats, vid 2030–2032 med bara dagens åk 1–2 kvar att lösa.")],
        tl=[("22 okt", "Möte med nytt borgarråd, som får en dragning från förvaltningen."), ("November", "Nämndmöte."), ("December", "Nämndmöte med beslut i frågan.")]),
    howto=dict(
        keys=[("Vad", "Alternativets nummer och vilka skolor det gäller."), ("När", "Vilka läsår barnen är evakuerade: 2028–2030, 2030–2032 eller 2032–2034."),
              ("Var", "Hur många lokaler barnen fördelas på, och vilka årskurser som går var."), ("Hur många", "Hur många platser varje lokal har och hur fullt det blir.")],
        defs=[("Beläggning", "(ordinarie elever + elever från Olovslund) ÷ skolans kapacitet. Över 100 % betyder att skolan blir fullare än sin bedömda kapacitet."),
              ("Förvaltningens nivå", f"Förvaltningens eget förslag placerar två årskurser på Ålstensskolan, som då får {pct(BENCH)} beläggning. Det är den högsta nivå förvaltningen själv accepterar och den vi jämför mot."),
              ("Elevtal och kapacitet", "Förvaltningens egna prognoser för respektive läsår och förvaltningens bedömda kapacitet per skola."),
              ("Elever från Olovslund", f"Olovslundsskolan har sju årskurser (F–6). Eleverna antas vara jämnt fördelade, så en årskurs är ungefär {num(OL[2028] / 7)} elever 2028."),
              ("Läsår", "”2028–2030” betyder två läsår: 2028/29 (år 1) och 2029/30 (år 2)."),
              ("pp", "Procentenheter. ”−0,8 pp” betyder 0,8 procentenheter under förvaltningens nivå. Skillnaden är beräknad på ej avrundade tal och kan därför avvika 0,1 från skillnaden mellan de visade procenttalen.")]),
    matt=[("Kapacitet", "1 alternativ analyserat, för 2028–2030.", f"14 alternativ: {n28} för 2028–2030 och {14 - n28} om renoveringen skjuts. Troligen fler om man utreder vidare."),
          ("Ekonomi", "Ca 32,2 Mkr* för paviljonger och bussning, ungefär 42 000 kr per barn och år. Lokalhyra för Ålsten saknas.",
           "Befintliga lokaler bedöms avsevärt mer kostnadseffektiva och är det som förvaltningens egna principer förordar. Även paviljonger kostar (hyra, underhåll, bygglov). Kostnaden ska utredas."),
          ("Organisation", "Evakuering uppdelad på 2 enheter.", "Samma komplexitet: 2 enheter."),
          ("Avstånd", "Bussning av ca 380 elever.", "Samtliga alternativ är skolor i Brommas närområde."),
          ("Barnens vardag och hälsa", "Förlängd skoldag med minst en timme, tidigare morgnar och senare eftermiddagar, ingen möjlighet att följa med in i klassrummet vid behov, mer trafik vid hämtning och lämning.",
           "Mindre påverkan. Barnen kan fortsätta gå och cykla, känner igen sig i närområdet och behåller tid för fritid, familj och lek."),
          ("Miljö", "Daglig bussning i två år ger utsläpp som förvaltningen inte kvantifierat. Fler föräldrar kan välja bil när busscheman inte passar.", "Ingen daglig busstransport."),
          ("Familjernas vardag", "Svår logistik, särskilt med 2–4 barn i olika åldrar. Mindre tid för frukost, middag och fritidsaktiviteter.", "Enklare logistik, senare starter och tidigare hemkomst."),
          ("Anpassad grundskola", "Avvecklas ht 2028 utan alternativ.", "Fasas ut kontrollerat om renoveringen skjuts (se Anpassad grundskola).")],
    anp=dict(lead="Förvaltningens förslag innebär att den anpassade grundskolan avvecklas till höstterminen 2028 utan något alternativ. Samma sak gäller de lokala alternativen för "
                  "2028–2030. Först när renoveringen skjuts hinner verksamheten fasas ut enligt stadens riktlinjer.",
             rows=[("Vad händer", "Anpassad grundskola måste evakueras eller stängas 2028", "Eleverna fasas ut, utom dem som går i åk 1–2 i dag", "Samtliga hinner fasas ut naturligt"),
                   ("Barn utan skolplats", "Kastas ut utan alternativ", "Endast åk 1–2 påverkas", "Inga"),
                   ("Alternativ", "Förvaltningens förslag och alt 1–4", "Alt 5–10", "Alt 11–14")],
             src="Föräldragruppens sammanställning, med utgångspunkt i stadens riktlinjer för utfasning. Frågan om hur de berörda barnen får skolplats behöver besvaras av förvaltningen oavsett vilket alternativ nämnden väljer."),
    todo=[("Kapacitet och beläggning.", f"Bekräfta bedömd kapacitet per skola och elevprognos per läsår. Förvaltningen anger att Nya Elementar har 98 % fyllnadsgrad (FAQ 2, sid 13). Det motsvarar dagens elevtal, "
           f"cirka 1{NB}040 av 1{NB}068. Förvaltningens egen prognos ger {pct(PROG['Nya Elementar'][2028] / 1068, 0)} ht 2028 och {pct(PROG['Nya Elementar'][2030] / 1068, 0)} ht 2030."),
          ("Paviljong, Åkeshovsvägen 7.", "Aktualisera utredningen från 2022 (8–9 salar, här räknat som 240 platser): mark, bygglov, tidplan och en skarp budget från Skolfastigheter i Stockholm AB. "
           "Förvaltningen pekar på att bollplanen används av idrotts- och föreningsverksamhet (FAQ 2, sid 15). Den påverkan behöver ingå."),
          ("Specialsalar vid paviljonglösning.", "Matsal (paviljong på Olovslundsskolans skolgård), musik i klassrummen, idrott på fotbollsplanen och slöjd. Slöjd kan ordnas som 1,25 timmar i veckan för 2–3 klasser, med promenad ca 700 m till Abrahamsberg."),
          ("Årskurser och syskon.", "Hur årskurserna fördelas på de två lokalerna, och hur syskon och skolväg påverkas."),
          ("Ledning och organisation.", "Olovslundsskolans ledning kan sitta på Nockebyhovsskolan, där den redan är en gång i veckan."),
          ("Anpassad grundskola.", "Plan för utfasning, och hur de berörda barnen får skolplats om renoveringen genomförs 2028."),
          ("Kostnad per elev.", "En jämförelse av alla kostnader för alla alternativ på lika villkor, inklusive bussning och lokalhyra."),
          ("Barnkonsekvensanalys", "för de alternativ som går vidare.")],
    kallor=[("Elevprognoser", "Utbildningsförvaltningens prognoser för elevantal per skolenhet 2025–2034."),
            ("Kapacitet", f"Förvaltningens bedömda kapacitet per skola: Abrahamsberg 780, Norra Ängby 784, Nya Elementar 1{NB}068, Ålsten 476, Äppelviken 680 (576 permanenta och 104 i paviljong)."),
            ("Paviljong", "Åkeshovsvägen 7: 8–9 salar enligt utredning från 2022, här räknat som 240 platser. Ej uppdaterat."),
            ("Antaganden", "Eleverna på Olovslund antas vara jämnt fördelade över F–6. Äppelviksskolans paviljong antas vara ledig från 2030, efter Höglandsskolans evakuering."),
            ("Förvaltningens nivå", f"{pct(BENCH)}: Ålstensskolan ht 2028 med två evakuerade årskurser enligt förvaltningens eget förslag."),
            ("FAQ 2", "Utbildningsförvaltningens ”Frågor och svar – del 2”, uppdaterad 2026-10-23. Använd för Vällingbyskolans kapacitet och elevtal (sid 18), fördelningen av årskurser på Ålstensskolan (sid 14–15), Nya Elementars fyllnadsgrad (sid 13) och bollplanen vid Åkeshov (sid 15)."),
            ("Inte med", "Lokalhyra för Ålstensskolan saknas. Kostnader för de lokala alternativen är inte beräknade. Vällingbyskolans beläggning (ca 98 %) är föräldragruppens beräkning av förvaltningens uppgifter och är inte kontrollerad mot en kapacitetsfil."),
            ("Kontroll", "Samtliga beläggningstal är omräknade från förvaltningens egna elevtal och kapacitet och stämmer med föräldragruppens arbetsblad efter rättning av alternativ 14 (se Beräkningsunderlag).")],
    kommun=dict(
        facts=[("2028–30", "Evakuering från ht 2028, två läsår. Förvaltningens mejl 17 sept anger 2,5 år."), ("2", "lokaler: paviljonger vid Vällingbyskolan och Ålstensskolan"),
               (num(OL[2028]), "elever (F–6) ht 2028 enligt förvaltningens prognos"), (pct(BENCH), "beläggning på Ålstensskolan, den högsta nivå förvaltningen accepterar")],
        val=dict(title="Vällingbyskolan, paviljonger", big=f"≈{num(ev_vall)}", big_t="elever i åk 2–6 bussas varje dag",
                 lines=[f"Platser: drygt 1{NB}050. Ordinarie elever: ca {num(vall_ord)}. Beläggning med evakuering: ca {pct(vall_bel, 0)}", "Källa: förvaltningens FAQ 2, sid 18. Beläggningen är föräldragruppens beräkning."]),
        als=dict(title="Ålstensskolan", big=f"≈{num(ev_als)}", big_t="elever år 1: förskoleklass och åk 6. År 2: förskoleklass och åk 1",
                 lines=[f"Platser: 476. Ordinarie elever: {num(PROG['Ålstensskolan'][2028])}. Beläggning med evakuering: {pct(BENCH)}", "Källa: förvaltningens FAQ 2, sid 14."]),
        cost=[("g", "Förlängd användning av de tillfälliga paviljongerna i Vällingby", ""), ("r", "Utökad paviljonghyra, 3 år", f"19{NB}350{NB}000{NB}kr"),
              ("r", "Bygglovsavgift m.m.", f"80{NB}000{NB}kr"), ("r", f"KPI-indexering, 2{NB}%", f"400{NB}000{NB}kr"),
              ("g", "Bussning av ca 380 elever, 178 dagar per år, i minst två år", ""), ("r", "Exklusive lov, ca 8 bussar", f"12{NB}400{NB}000{NB}kr*"),
              ("r", "Lokalhyra Ålstensskolan", "uppgift saknas"), ("t", "Total kostnad för paviljonger och bussning", f"32{NB}230{NB}000{NB}kr*")],
        note1=f"Det motsvarar ungefär 42{NB}000 kr per barn och år. Totalen inkluderar inte lokalhyra för Ålstensskolan. * Uppskattning baserad på kostnaden vid evakueringen av Olovslundsskolan: "
              f"310{NB}000 kr för 4 bussar från Abrahamsberg, vilket motsvarar ca 200 elever. För 380 elever behövs ca 8 bussar.",
        note2="Anpassad grundskola: avvecklas till ht 2028 utan alternativ. 2030–2032 och 2032–2034: ej analyserat av förvaltningen."),
    windows=dict(lead="Förvaltningens egna prognoser visar att skolorna i närområdet blir allt mindre fulla. Därför ökar antalet alternativ för varje år evakueringen skjuts upp.",
                 rows=[("Elever på Olovslund (F–6)", *[f"{num(OL[w])} → {num(OL[w + 1])}" for w in (2028, 2030, 2032)]),
                       ("Förvaltningens analys", "1 alternativ", "Ej analyserat", "Ej analyserat"),
                       ("Föräldragruppens alternativ", str(n28), str(n30), str(n32)),
                       ("Lägsta högsta beläggning", *[f"{pct(lowest[w]['pct'])} (alt {', '.join(map(str, lowest[w]['alts']))})" for w in (2028, 2030, 2032)]),
                       ("Anpassad grundskola", "Stängs 2028", "Fasas ut, utom dagens åk 1–2", "Fasas ut: inga barn utan skolplats")],
                 src=f"Förvaltningens prognoser för elevtal 2025–2034 och bedömd kapacitet per skola. Äppelviksskolan: 576 platser i permanenta lokaler och 104 i paviljong. Paviljongen antas ledig först från 2030; "
                     f"utan den är beläggningen {pct(av[2028] / 576, 0)} 2028 och {pct(av[2029] / 576, 0)} 2029, inte {pct(av[2028] / 680, 0)} och {pct(av[2029] / 680, 0)} som linjen visar. "
                     f"Inget av föräldragruppens alternativ börjar före 2030 med Äppelviken."),
)

DATA = dict(asOf="2026-10-25", bench=BENCH, ol={str(k): v for k, v in OL.items()}, schools=SCHOOLS, alts=alts, chart=chart, text=T)
js = ("/* Genererad av tools/alt/build_data.py. Ändra inte för hand.\n"
      "   Källa: förvaltningens elevprognoser och kapacitet, omräknade och kontrollerade mot föräldragruppens arbetsblad.\n"
      "   Koordinater: SL:s platsuppslag 2026-10-20. Stadsdelsområde per skola enligt stadens indelning. */\n"
      "window.ALT = " + json.dumps(DATA, ensure_ascii=False, separators=(",", ":")) + ";\n")
open(OUT, "w", encoding="utf-8").write(js)
print("skrev", os.path.relpath(OUT), len(js), "tecken |", len(alts), "alternativ |", f"referensnivå {pct(BENCH)}", "| Vällingby ca", pct(vall_bel, 0))
