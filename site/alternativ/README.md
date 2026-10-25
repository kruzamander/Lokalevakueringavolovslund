# Alternativ till evakuering av Olovslundsskolan: webbpresentation

Statisk sida (ingen byggsteg). Öppna `index.html` via valfri webbserver.

- `index.html`, `alt.css`, `alt.js`: sidan. Svajpa mellan de 14 alternativen (`#/svajp/N`), dubbelklicka eller dubbeltryck för detaljsidan (`#/alt/N`).
- `data.js`: genereras av `tools/alt/build_data.py` från `tools/alt/alt_calc.json` (samma underlag som PDF:en). Ändra inte för hand.
- `Alternativ-evakuering-Olovslundsskolan-A4-utkast-4.pdf`: PDF-versionen av samma innehåll.
- `districts.geojson` (valfri): lägg en GeoJSON-fil (WGS84, polygoner per stadsdelsområde, namnet i `name`/`NAMN`) i samma mapp, så ritas stadsdelsområdenas gränser på kartorna automatiskt.

Kartan visar fågelväg från Olovslundsskolan, inte verklig väg. Paviljong Åkeshovsvägen 7 saknar koordinat och är inte inritad: lägg `lat`/`lon` på `PAV` i `SCHOOLS` i `tools/alt/build_data.py` och kör om skriptet.

Uppdatera data: `python3 tools/alt/build_data.py`
