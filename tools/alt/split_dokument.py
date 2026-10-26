"""Delar upp yrkandet med bilagor (95 sidor) i separata PDF:er under site/alternativ/dokument/.

Användning: python3 tools/alt/split_dokument.py <yrkande-inkl-bilagor.pdf> [faq-2.pdf] [enkat.pdf]

Namnlistan (sid 65-95 i yrkandet) tas medvetet INTE med: den innehåller namn och e-postadresser till enskilda.
Namnlistan i anonymiserad form finns som /namnlista.pdf på webbplatsen.
"""
import shutil
import sys
from pathlib import Path

from pypdf import PdfReader, PdfWriter

OUT = Path(__file__).resolve().parents[2] / "site" / "alternativ" / "dokument"

# fil, första sida, sista sida (1-indexerat, inklusive), PDF-titel
PARTS = [
    ("Yttrande-och-yrkande_2026-10-14.pdf", 1, 7, "Yttrande och yrkande angående evakuering av Olovslundsskolan, 2026-10-14"),
    ("Dnr-2017-003560_Beslut_Miljo-och-halsoskyddsnamnden_2017-10-30.pdf", 8, 21,
     "Dnr 2017-003560, Föreläggande om att inkomma med åtgärdsförslag avseende ventilation och buller, Olovslundsskolan"),
    ("Dnr-UTBF-2023-7195_Tjansteutlatande_2025-05-21.pdf", 22, 30,
     "Dnr UTBF 2023/7195, Olovslundsskolan: Verksamhetsanpassningar i samband med underhåll"),
    ("Dnr-SISAB-2025-234_Tjansteutlatande_2025-05-17.pdf", 31, 36,
     "Dnr SISAB 2025/234, Inriktningsbeslut ombyggnad kök och matsal samt underhåll hus A Olovslundsskolan"),
    ("Dnr-2.6.3-2606-2018_Tjansteutlatande_2021-10-04.pdf", 37, 48,
     "Dnr 2.6.3-2606/2018, Evakueringsskola med idrottstält i Västerort"),
    ("Presentation-till-Olovslundsskolans-barn_sep-2026.pdf", 49, 55, "Presentation till Olovslundsskolans barn, september 2026"),
    ("Mejl-Mika-Metso_Aterkoppling-fran-presidiemotet_2026-09-17.pdf", 56, 56, "Mejl från Mika Metso: Återkoppling från presidiemötet, 2026-09-17"),
    ("Dnr-UTBF-2022-240_Barnkonsekvensanalys-Matteusskolan_2025-05-28.pdf", 57, 64,
     "Dnr UTBF 2022/240, Barnkonsekvensanalys för Matteusskolan: underhåll och evakuering"),
]


def main():
    src = Path(sys.argv[1])
    OUT.mkdir(parents=True, exist_ok=True)
    reader = PdfReader(src)
    for name, a, b, title in PARTS:
        w = PdfWriter()
        for i in range(a - 1, b):
            w.add_page(reader.pages[i])
        w.add_metadata({"/Title": title})        # ingen författare eller annan metadata från originalet
        with open(OUT / name, "wb") as fh:
            w.write(fh)
        print(f"{name}: sid {a}-{b} ({b - a + 1} sidor)")
    if len(sys.argv) > 2:
        shutil.copyfile(sys.argv[2], OUT / "Fragor-och-svar-del-2_2026-10-23.pdf")
    if len(sys.argv) > 3:
        shutil.copyfile(sys.argv[3], OUT / "Barnkonsekvensanalys-AGR-Olovslundsskolan_enkat-vardnadshavare.pdf")


if __name__ == "__main__":
    main()
