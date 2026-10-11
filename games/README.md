# games

Spel att skjuta på med laser-mouse. Varje spel är en fristående webbsida som reagerar på vanliga musklick – så de fungerar lika bra med mus som med laser.

| Spel | Beskrivning |
|------|-------------|
| [`gliding-targets/`](gliding-targets/) | **Glidande mål** – måltavlor glider över skärmen, poäng efter ring |

## Starta
- **Från laser-mouse:** välj spel under *Spel* och tryck *Starta på vald skärm* – spelet öppnas i helskärm på den kalibrerade skärmen.
- **Fristående:** öppna spelets `index.html` i en webbläsare och tryck **F** för helskärm.

## Nytt spel
Skapa en katalog med `index.html` och en `game.json`:
```json
{ "name": "Spelets namn", "description": "En mening om spelet." }
```
laser-mouse hittar spelet automatiskt.

### Designregler för projektor + webbkamera
- Mörk bakgrund, dova färger. Ljusa ytor bländar kameran.
- Låg röd kanal i grafiken – detektorn letar efter röda/varma ljuspunkter.
- Inga små ljusa prickar (t.ex. kulhål) – rita dem mörka.
- Reagera på `pointerdown`/klick. Esc i menyn stänger fönstret.
