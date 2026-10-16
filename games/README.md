# Games

Games to shoot at with Laser Mouse. Each game is a standalone web page that reacts to ordinary mouse clicks – so they work just as well with a mouse as with a laser.

| Game | Description |
|---|---|
| [`gliding-targets/`](gliding-targets/) | **Gliding Targets** (*Glidande mål*) – targets glide across the screen, score by ring. Easy, medium, hard or pop-up. Swedish and English. |
| [`clay-pigeons/`](clay-pigeons/) | **Clay Pigeons** (*Lerduvor*) – clays thrown in an arc: trap, skeet or sporting. 25 clays, two shots per throw, automatic release or call "Pull!". Swedish and English. |
| [`hunting-stand/`](hunting-stand/) | **Hunting Stand** (*Jaktpasset*) – moose, roe deer, boar, fox, hare and birds pass your stand. Judged by hunting ethics: clear line of fire, safe backstop (no rock, ridge, building or fellow hunter behind), calf before cow, never a sow with piglets, identify the target. Swedish and English. |
| [`calm-practice/`](calm-practice/) | **Calm Practice** (*Lugn träning*) – no clock. One fixed target at a time in a new place; misses leave a mark, a hit shows where the shot landed and its score, then the next target appears. Three target sizes. Swedish and English. |
| [`shot-timer/`](shot-timer/) | **Shot Timer** (*Skottimer*) – a shot timer with six drills: free timer, mount drill, Bill drill, El Presidente, reaction and grouping. False starts, saved results, personal bests and trends. Swedish and English. |
| [`hub/`](hub/) | **Game menu** (*Spelmeny*) – the start page that lists all the games above. Not a game itself. |
| [`shared/`](shared/) | Shared code: `gunshots.js` – synthesized gunshot sounds (shotgun, pistol, rifle, laser); `hub.js` – the *Game menu* button every game shows in its menu |

## Playing
- **From Laser Mouse:** press *Start games on selected display* – the game menu opens full screen on the calibrated display, in the same language as Laser Mouse. Shoot a game to start it; every game has a *Game menu* button that leads back, and *Quit* in the menu returns to the computer. Everything can be done with the gun.
- **Standalone:** open the game's `index.html` in a browser and press **F** for full screen. Add `?lang=en` for English, or shoot the language button in the menu.

## Making a game
See [Writing a game](../docs/TECHNICAL.md#writing-a-game) – including the design rules that keep the projector from confusing the laser detector.
