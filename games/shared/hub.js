// Link back to the game menu (games/hub/). Only active when the games run
// inside Laser Mouse (window.laserGames exists); standalone in a browser the
// games behave as before.
//
//   Hub.available        true inside Laser Mouse
//   Hub.button(S, H, lang)  a menu button { id: 'hub', … } for the bottom-left corner
//   Hub.exit(lang)       to the game menu (or window.close() when standalone)
(() => {
  const TEXT = {
    sv: { label: 'Spelmeny', sub: 'Tillbaka till alla spel' },
    en: { label: 'Game menu', sub: 'Back to all games' },
  };
  const available = !!window.laserGames;

  const go = (lang) => {
    location.href = `${new URL('../hub/index.html', location.href).href}?lang=${lang}`;
  };

  window.Hub = {
    available,
    go,
    exit: (lang) => (available ? go(lang) : window.close()),
    button(S, H, lang) {
      const t = TEXT[lang] || TEXT.sv;
      return { id: 'hub', label: t.label, sub: t.sub, x: 40 * S, y: H - 114 * S, w: 330 * S, h: 90 * S, small: true };
    },
  };
})();
