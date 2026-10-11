# laser-mouse

Delprojekt i **shooting-cinema**. Gör om en röd laserprick på väggen, sedd genom webbkameran, till ett musklick på skärmen. Klicket kan sedan träffa vad som helst: egna måltavlor, Paint eller Doom.

## Kom igång

```bash
cd laser-mouse
npm install
npm start          # eller: npm run dev  (öppnar även DevTools)
```

Första gången frågar macOS om kameratillstånd. Har du nekat tidigare slår du på det under
**Systeminställningar → Integritet och säkerhet → Kamera** (för *Electron* eller den terminal du startar från).

## Struktur

```
laser-mouse/
├── main/main.js              main-processen: fönster, behörigheter, skärmar, överlägg, musklick
├── preload.js                säker brygga huvudfönster ↔ main
├── screen-overlay-preload.js brygga för överläggsfönstret
└── renderer/
    ├── index.html
    ├── styles.css
    ├── camera.js       webbkamera → canvas, onFrame-krok för detektering
    ├── laser-detect.js punktdetektor: ljus prick som är ljusare än allt runt den
    ├── overlay.js      ritar kryss och skottmarkeringar i kamerabilden
    ├── static-spots.js lär in fasta prickar (lysdioder, reflexer) som ska ignoreras
    ├── calibration.js  homografi (ren JS), kalibreringsinsamling
    ├── sound.js        ljud- och röståterkoppling (Web Audio + svensk talsyntes)
    ├── screen-control.js  skärmval, kalibreringsflöde, testläge
    ├── screen-overlay.*   genomskinligt helskärmslager på vald skärm
    └── app.js          gränssnitt: kameraval, reglage, avläsning
```

## Etapper

| # | Etapp | Klart när | Status |
|---|-------|-----------|--------|
| 1 | **Kamerabild** – Electron-skal, getUserMedia, video på canvas | Väggen syns i fönstret | ✅ |
| 2 | **Hitta pricken** – tröskla röda/ljusa pixlar, tyngdpunkt, rita kryss | Krysset följer lasern | ✅ |
| 3 | **Kalibrering** – välj skärm, peka på 4 eller 9 punkter → homografi | Kryss på skärmen följer lasern | ✅ |
| 4 | **Klick** – libnut (nut.js) i main via IPC | Lasern klickar på riktigt | 🧪 testas |
| 5 | **Använd det** – egna mål, Paint, Doom | 🎯 | ⏳ |

### Utrustning
- Röd laserpekare, ~650 nm, svag klass (< 1 mW räcker)
- 650 nm bandpassfilter framför webbkameralinsen (gör detekteringen nästan trivial)

## Tips för etapp 2

Detektorn letar efter en **liten punkt som är mycket ljusare än allt runt omkring** (ringtest), inte bara efter röd färg. Därför triggar inte ansikten, lampor eller röda föremål.

- Slå på **Visa mask** och peka med lasern – gröna pixlar är det appen tolkar som laser.
- **Kontrast mot omgivning** är huvudreglaget: höj om annat triggar, sänk om lasern tappas.
- Står du långt bort och pricken blir väldigt liten: sänk **Min klumpstorlek** till 1.
- Triggar en fast prick (lysdiod, reflex, lampa)? Släck lasern och tryck **Lär in fasta prickar**. Appen tittar i 2 s och ignorerar sedan de prickarna (grå streckade ringar i kamerabilden). Zonerna sparas per kameraupplösning; **Rensa** tar bort dem.
- Om kameran tillåter det, testa kortare **exponeringstid**. Bilden blir mörk men lasern lyser kvar.
- **Skott** räknas när lasern tänds efter att ha varit släckt – testa genom att klicka pekaren av och på.
- Inställningarna sparas automatiskt mellan körningar.

## Tips för etapp 3

1. Rikta kameran så att den ser hela skärmen du vill kalibrera.
2. Välj skärm och antal punkter, tryck **Kalibrera**.
3. Håll lasern stilla mitt i varje ring tills den gröna bågen är full. Flytta sedan till nästa.
4. När sista punkten är klar startar testläget: ett blått kryss på skärmen följer lasern, och tänd/släck ger en grön skottring.
5. I kamerabilden visas skärmens kontur som en streckad linje – den ska ligga precis på skärmens kanter.

Kalibreringen sparas per skärm. Esc avbryter. Flyttar du kameran behöver du kalibrera om.

### Ljud – kalibrera utan att titta på skärmen
| Ljud | Betyder |
|------|---------|
| Röst: "Punkt 2, uppe till höger" | Vart du ska sikta härnäst |
| Stigande ton | Lasern hålls stilla – punkten fylls |
| Två ljusa toner | Punkten registrerad |
| Dubbelt surr | Du står kvar på en redan tagen punkt – flytta |
| Fanfar + "Klart" | Kalibreringen färdig, testläge startar |
| "Pang" | Skott i testläget |

En redan registrerad punkt kan aldrig registreras igen, och en tappad bildruta eller två nollställer inte förloppet.

## Etapp 4 – riktiga musklick

Kör `npm install` en gång till (musstyrningen, `@nut-tree-fork/libnut`, har lagts till).

- **Klicka vid skott**: när lasern tänds efter att ha varit släckt klickar appen på motsvarande punkt på vald skärm.
- **Muspekaren följer lasern**: pekaren flyttas hela tiden dit lasern pekar.
- Båda är alltid **av** när appen startar, och stängs av när du kalibrerar om eller byter skärm.
- Träffar utanför skärmen ignoreras. Högst ett klick per 80 ms.
- **Nödstopp: ⌘⇧L** (Ctrl+Shift+L på Windows) – fungerar även när en annan app har fokus.

**macOS:** första gången frågar systemet om *Hjälpmedel*-behörighet. Slå på **Electron** under
Systeminställningar → Integritet och säkerhet → Hjälpmedel, och starta sedan om appen.

## Spel

Under **Spel** i panelen listas spelen i [`../games/`](../games/). **Starta på vald skärm** öppnar spelet i helskärm på den skärm du har kalibrerat; Esc i spelets meny (eller **Stäng**) stänger det. Slå på **Klicka vid skott** så blir laserträffarna klick i spelet.

## Inskjutning

Lasern sitter aldrig exakt i siktlinjen (tejpad på pipan, eller en laserpatron). Tryck **Inskjutning**: ett mål visas mitt på vald skärm, sikta med kornet mitt på det och skjut fem skott. Appen räknar ut medianavvikelsen (ett ryckt skott förstör inte) och flyttar därefter alla träffar och musklick lika mycket. Resultatet visar också hur samlad träffbilden var.

- Sparas per skärm och gäller tills du trycker **Nollställ** eller gör om den.
- Gör om inskjutningen om du flyttar lasern eller ändrar skjutavstånd.
- Inga musklick görs under inskjutningen.
