"""Enhetstester för matning.py. Inga nätanrop.   python3 -I -m unittest discover -s tools/sl -v"""
import csv, os, sys, tempfile, unittest
from datetime import datetime, timezone
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import matning as m

NU = datetime(2026, 10, 20, 12, 48, 57, tzinfo=timezone.utc)


def ben(klass, minuter, namn_fran="A", namn_till="B", linje=None, dep="2026-10-20T12:55:00Z", arr="2026-10-20T13:05:00Z"):
    t = {"product": {"class": klass}}
    if linje: t["disassembledName"] = linje
    return {"duration": minuter * 60, "transportation": t, "origin": {"name": namn_fran, "departureTimePlanned": dep},
            "destination": {"name": namn_till, "arrivalTimePlanned": arr}}


def resa(tot_min, legs, rt=None, byten=0):
    r = {"tripDuration": tot_min * 60, "interchanges": byten, "legs": legs}
    if rt is not None: r["tripRtDuration"] = rt * 60
    return r


SVAR = {"journeys": [
    resa(60, [ben(100, 30), ben(5, 20, "Brommaplan", "Sundbyvägen", "117"), ben(99, 10)]),
    resa(49, [ben(100, 30), ben(5, 11, "Brommaplan, Stockholm", "Sundbyvägen, Stockholm", "117"), ben(99, 8)], rt=50),
]}


class Fonster(unittest.TestCase):
    def test_gransvarden(self):
        def sv(h, mi, dag=20):   # 2026-10-20 är en tisdag
            return m.i_matfonster(datetime(2026, 10, dag, h, mi, tzinfo=m.STHLM))
        self.assertEqual([sv(6, 29), sv(6, 30), sv(8, 59), sv(9, 0)], [False, True, True, False])
        self.assertEqual([sv(13, 59), sv(14, 0), sv(17, 29), sv(17, 30)], [False, True, True, False])
        self.assertFalse(sv(7, 0, dag=24))   # lördag


class Sammanfatta(unittest.TestCase):
    def test_valjer_snabbaste_och_summerar(self):
        rad, status = m.sammanfatta(SVAR, NU)
        self.assertEqual(status, "ok")
        self.assertEqual((rad["totalt_min_realtid"], rad["totalt_min_planerad"]), (50.0, 49.0))
        self.assertEqual((rad["buss_min"], rad["gang_min"], rad["ovrigt_min"]), (11.0, 38.0, 1.0))
        self.assertEqual((rad["linjer"], rad["antal_resor"], rad["pa_hallplats"]), ("117", 2, "Brommaplan, Stockholm"))
        self.assertEqual(rad["till_avgang_min"], 6.0)   # 12:48:57 -> 12:55:00

    def test_saknad_planerad_tid_tappar_inte_raden(self):
        r = resa(49, [ben(5, 49, linje="117")]); del r["tripDuration"]; r["tripRtDuration"] = 49 * 60
        rad, status = m.sammanfatta({"journeys": [r]}, NU)
        self.assertEqual((status, rad["totalt_min_realtid"], rad["totalt_min_planerad"]), ("ok", 49.0, ""))

    def test_transportation_null_och_okand_klass(self):
        l = ben(5, 5, linje="117"); l["transportation"] = None
        rad, status = m.sammanfatta({"journeys": [resa(10, [l, ben(6, 5, linje="9")])]}, NU)
        self.assertEqual(status, "ok (oväntad färdklass: 6, None)")
        self.assertEqual(rad["ovrigt_min"], 10.0)   # varken buss eller gång syns i summan

    def test_inga_resor_och_inga_tider(self):
        self.assertEqual(m.sammanfatta({"journeys": [], "systemMessages": [{"text": "ingen rutt"}]}, NU), ({}, "inga bussresor: ingen rutt"))
        self.assertEqual(m.sammanfatta({"journeys": [{"legs": [ben(5, 5)]}]}, NU)[1], "tolkningsfel: ingen resa har restid")
        self.assertEqual(m.sammanfatta({"journeys": [{"tripDuration": 600, "legs": []}]}, NU)[1], "tolkningsfel: resan saknar delsträckor")


class Text(unittest.TestCase):
    def test_formeltecken_och_radbrytningar(self):
        self.assertEqual(m.text("=HYPERLINK(1)"), "'=HYPERLINK(1)")
        self.assertEqual(m.text("  +1 \n 2\t"), "'+1 2")
        self.assertEqual(m.text("Brommaplan"), "Brommaplan")
        self.assertEqual(m.text(None), "")


class Fil(unittest.TestCase):
    def test_gammalt_schema_flyttas_undan(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "x.csv")
            open(p, "w", encoding="utf-8").write("a,b\n1,2\n")
            self.assertTrue(m.forbered_fil(p, NU))
            self.assertFalse(os.path.exists(p))
            self.assertIn("x.gammalt-schema-20261020T124857Z.csv", os.listdir(d))
            open(p, "w", encoding="utf-8").write(",".join(m.KOLUMNER) + "\n")
            self.assertFalse(m.forbered_fil(p, NU))   # samma schema: fortsätt i samma fil
            self.assertTrue(m.forbered_fil(os.path.join(d, "ny.csv"), NU))


class Korning(unittest.TestCase):
    def kor(self, hamta_fn, force=True):
        with tempfile.TemporaryDirectory() as d, mock.patch.object(m, "hamta", hamta_fn), \
                mock.patch.object(sys, "argv", ["matning.py", "--ut", os.path.join(d, "u", "x.csv")] + (["--force"] if force else [])):
            kod = m.main()
            with open(os.path.join(d, "u", "x.csv"), newline="", encoding="utf-8") as f:
                return kod, list(csv.DictReader(f))

    def test_ok_ger_en_rad_per_mal_i_ordning(self):
        kod, rader = self.kor(lambda mal: (SVAR, None))
        self.assertEqual((kod, [r["mal"] for r in rader]), (0, m.MAL))
        self.assertTrue(all(r["status"] == "ok" for r in rader))
        self.assertEqual(list(rader[0]), m.KOLUMNER)

    def test_alla_fel_ger_slutkod_3_men_sparar_raderna(self):
        kod, rader = self.kor(lambda mal: (None, "HTTP 500: x"))
        self.assertEqual((kod, len(rader)), (3, len(m.MAL)))
        self.assertTrue(all(r["status"].startswith("fel") for r in rader))

    def test_ett_fel_ar_inte_larm(self):
        kod, rader = self.kor(lambda mal: (None, "x") if mal == "Nya Elementar" else (SVAR, None))
        self.assertEqual(kod, 0)
        self.assertEqual([r["status"][:2] for r in rader].count("fe"), 1)

    def test_utanfor_fonster_hoppar_over(self):
        with tempfile.TemporaryDirectory() as d, \
                mock.patch.object(m, "i_matfonster", lambda lokal: False), \
                mock.patch.object(sys, "argv", ["matning.py", "--ut", os.path.join(d, "x.csv")]):
            self.assertEqual(m.main(), 0)
            self.assertFalse(os.path.exists(os.path.join(d, "x.csv")))


if __name__ == "__main__":
    unittest.main()
