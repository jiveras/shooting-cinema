// Ritar kryss och skottmarkeringar ovanpå kamerabilden.

(function () {
  const SHOT_LIFETIME = 3000; // ms en skottmarkering syns

  function crosshair(ctx, x, y, color) {
    const s = 18;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(x, y, s * 0.6, 0, Math.PI * 2);
    ctx.moveTo(x - s, y);
    ctx.lineTo(x - s * 0.3, y);
    ctx.moveTo(x + s * 0.3, y);
    ctx.lineTo(x + s, y);
    ctx.moveTo(x, y - s);
    ctx.lineTo(x, y - s * 0.3);
    ctx.moveTo(x, y + s * 0.3);
    ctx.lineTo(x, y + s);
    ctx.stroke();
    ctx.restore();
  }

  function shots(ctx, list, now) {
    ctx.save();
    for (const shot of list) {
      const age = now - shot.t;
      if (age > SHOT_LIFETIME) continue;
      const a = 1 - age / SHOT_LIFETIME;
      ctx.strokeStyle = `rgba(255, 214, 10, ${a})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(shot.x, shot.y, 10 + (1 - a) * 20, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  window.LaserOverlay = { crosshair, shots, SHOT_LIFETIME };
})();
