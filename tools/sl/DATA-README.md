# SL-mätningar: Olovslundsskolan till skolor i närområdet

Den här grenen innehåller bara mätdata (`sl_matningar.csv`). Mätningen görs av GitHub Actions under skoltid,
vardagar 06:30–09:00 och 14:00–17:30 svensk tid (`tools/sl/matning.py`). Varje mätning är en egen commit, så
historiken visar när datan tillkom. Testkörningar sparas i grenen `sl-matningar-test`, aldrig här.

**Vad som mäts.** SL:s öppna reseplanerare (Trafiklab Journey-planner v2) tillfrågas om en resa med *enbart buss*
från Olovslundsskolan till respektive skola, avgång "nu". Planeraren returnerar högst tre resor. Raden beskriver
den snabbaste av dem. Det ger en något kortare tid än genomsnittet av de tre, alltså inte en överdrift.

**Det är planerade tider med realtidsuppdateringar, inte faktiskt uppmätta restider.** Mätningen visar vad en
resenär som frågar SL får veta, inte hur lång tid resan verkligen tog.

**Det gäller SL:s ordinarie busstrafik.** Om förvaltningen i stället ordnar egen skolbussning (egna bussar, andra
hållplatser och körvägar) syns den inte här. Eftersom metro inte är tillåten väljer planeraren ibland långa
promenader i stället. Därför är `buss_min` (tid i bussen) och `gang_min` (tid till fots) var för sig mer
upplysande än `totalt_min_realtid`.

**Tidpunkterna är inte exakt var 5:e minut.** GitHub kan försena eller hoppa över schemalagda körningar. Använd
`tid_utc` som tidpunkt och räkna inte med jämna intervall.

| Kolumn | Betydelse |
|---|---|
| `tid_utc`, `tid_lokal`, `veckodag` | när mätningen gjordes |
| `mal` | skolan resan går till |
| `totalt_min_realtid` | restiden från avgång till ankomst enligt SL:s realtidsprognos, i minuter. Väntan *innan* första avgången ingår inte, se `till_avgang_min` |
| `totalt_min_planerad` | samma enligt tidtabell (kan vara tom) |
| `buss_min` | tid i bussen (summan av alla bussben) |
| `gang_min` | gångtid till och från hållplats, samt mellan hållplatser |
| `ovrigt_min` | resten av restiden: väntan vid byten och annat som varken är buss eller gång |
| `till_avgang_min` | minuter från mätningen till att resan startar |
| `byten` | antal byten |
| `linjer` | bussnummer |
| `pa_hallplats`, `av_hallplats` | hållplats där man stiger på respektive av |
| `avgang_lokal`, `ankomst_lokal` | avgång och ankomst (svensk tid) |
| `antal_resor` | hur många resor SL returnerade (0–3) |
| `status` | `ok`, `inga bussresor` eller ett felmeddelande. Felrader sparas med flit. Börjar statusen med `ok` är raden användbar |

Skolor: Vällingbyskolan, Abrahamsbergsskolan, Norra Ängby skola, Nya Elementar, Äppelviksskolan och Ålstensskolan.
Skollov och helgdagar filtreras inte bort. Gör det i analysen. Ändras kolumnerna i skriptet flyttas den gamla
filen undan som `sl_matningar.gammalt-schema-<tid>.csv` i stället för att blandas med den nya.
