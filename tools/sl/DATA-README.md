# SL-mätningar: Olovslundsskolan till skolor i närområdet

Den här grenen innehåller bara mätdata (`sl_matningar.csv`). Mätningen görs av GitHub Actions var 5:e minut
vardagar 06:30–09:00 och 14:00–17:30 svensk tid (`tools/sl/matning.py`).

**Vad som mäts.** SL:s öppna reseplanerare (Trafiklab Journey-planner v2) tillfrågas om en resa med *enbart buss*
från Olovslundsskolan till respektive skola, avgång "nu". Planeraren returnerar högst tre resor. Raden beskriver
den snabbaste av dem, och `forsta_resan_min_realtid` är den först avgående resan.

**Det är planerade tider med realtidsuppdateringar, inte faktiskt uppmätta restider.** Mätningen visar vad en
resenär som frågar SL får veta, inte hur lång tid resan verkligen tog.

| Kolumn | Betydelse |
|---|---|
| `tid_utc`, `tid_lokal`, `veckodag` | när mätningen gjordes |
| `mal` | skolan resan går till |
| `totalt_min_realtid` | hela resan från dörr till dörr enligt SL:s realtidsprognos, i minuter |
| `totalt_min_planerad` | samma enligt tidtabell |
| `buss_min` | tid i bussen (summan av alla bussben) |
| `gang_min` | gångtid till och från hållplats, samt mellan hållplatser |
| `byten` | antal byten |
| `linjer` | bussnummer |
| `pa_hallplats`, `av_hallplats` | hållplats där man stiger på respektive av |
| `avgang_lokal`, `ankomst_lokal` | avgång och ankomst (svensk tid) |
| `forsta_resan_min_realtid` | den först avgående av de föreslagna resornas totaltid |
| `antal_resor` | hur många resor SL returnerade (0–3) |
| `status` | `ok`, `inga bussresor` eller felmeddelande. Felrader sparas med flit |

Skolor: Vällingbyskolan, Abrahamsbergsskolan, Norra Ängby skola, Nya Elementar, Äppelviksskolan och Ålstensskolan.
Skollov och helgdagar filtreras inte bort. Gör det i analysen.
