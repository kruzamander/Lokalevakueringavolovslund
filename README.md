# Lokalevakueringavolovslund
https://www.skrivunder.com/stoppa_evakueringen_av_olovslundsskolan_till_vallingbyskolan?utm_source=whatsapp

## Hitta till Vällingbyskolan med buss

Skanna QR-koden (eller klicka på länken) för att öppna Google Maps med en resa från din nuvarande position till Vällingbyskolan, med kollektivtrafik och buss som valt färdmedel.

[![QR-kod: buss till Vällingbyskolan](qr/vallingbyskolan-buss.png)](https://www.google.com/maps/dir//V%C3%A4llingbyskolan,+Stockholm/data=!4m4!4m3!2m1!5e0!3e3)

Länk: https://www.google.com/maps/dir//V%C3%A4llingbyskolan,+Stockholm/data=!4m4!4m3!2m1!5e0!3e3

> Obs: Google Maps tolkar bussvalet som en *preferens*. Om inga bussresor finns kan även andra färdmedel visas. Kontrollera gärna att "Bus" är förbockat under filtren.

## Skolkatalog 28/30 – hemsida (parodi)

`site/` är en fristående statisk hemsida, en svajpbar skolkatalog där varje klass har en buss i stället för ett klassfoto. Den behöver ingen byggprocess, laddar inga externa resurser (typsnittet Jost ligger lokalt, OFL-licens) och använder inga cookies eller spårare.

- Öppna `site/index.html` via valfri webbserver, t.ex. `python3 -m http.server -d site`.
- Bläddra genom att svajpa, med pilknapparna eller med piltangenterna. Varje sida har en egen adress (`#sida-3`).
- Tänkt adress: https://www.lokalevakueringolovslundsskolan.nu
- Kontakt: olovslundsskolanforaldrar@gmail.com

## Utskriftsversion (A4)

`print/skolkatalog-28-30-A4.pdf` är en PDF med alla 12 sidor, en sida per A4-ark, med QR-koder och klickbara länkar. Den är byggd från samma innehåll som hemsidan (`print/katalog-print.html` + `print/print.css`, som använder bilderna och typsnittet i `site/`).

- Skriv ut i faktisk storlek (inte "anpassa till sida"). Omslagets färger går ut till arkets kant, så på en vanlig skrivare blir det en vit kant.
- För att göra om PDF:en efter ändringar: öppna `print/katalog-print.html` i Chrome och välj Skriv ut, A4, inga marginaler, "Bakgrundsgrafik" på.
