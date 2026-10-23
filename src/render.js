import { TILE, VIEW_W, VIEW_H, DIRS, TANK, WEAPONS, ITEM_LIFE_MS } from './config.js';
import { isWall } from './map.js';

const BRICK = ['#7c4630', '#8a5238', '#6d3d29'];

function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255;
  let g = (n >> 8) & 255;
  let b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt;
    g += (255 - g) * amt;
    b += (255 - b) * amt;
  } else {
    r *= 1 + amt;
    g *= 1 + amt;
    b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function visibleBounds(game, cam) {
  return {
    c0: Math.max(0, Math.floor(cam.x / TILE) - 1),
    c1: Math.min(game.map.cols - 1, Math.floor((cam.x + VIEW_W) / TILE) + 1),
    r0: Math.max(0, Math.floor(cam.y / TILE) - 1),
    r1: Math.min(game.map.rows - 1, Math.floor((cam.y + VIEW_H) / TILE) + 1),
  };
}

function drawFloor(ctx, game, cam) {
  const b = visibleBounds(game, cam);
  ctx.fillStyle = '#0e0e16';
  ctx.fillRect(b.c0 * TILE, b.r0 * TILE, (b.c1 - b.c0 + 1) * TILE, (b.r1 - b.r0 + 1) * TILE);
  ctx.strokeStyle = 'rgba(255,255,255,0.035)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let c = b.c0; c <= b.c1 + 1; c++) {
    const x = c * TILE + 0.5;
    ctx.moveTo(x, b.r0 * TILE);
    ctx.lineTo(x, (b.r1 + 1) * TILE);
  }
  for (let r = b.r0; r <= b.r1 + 1; r++) {
    const y = r * TILE + 0.5;
    ctx.moveTo(b.c0 * TILE, y);
    ctx.lineTo((b.c1 + 1) * TILE, y);
  }
  ctx.stroke();
}

function drawBrick(ctx, x, y, seed) {
  ctx.fillStyle = '#2a1611';
  ctx.fillRect(x, y, TILE, TILE);
  const base = BRICK[Math.abs(seed) % 3];
  for (let row = 0; row < 4; row++) {
    const yy = y + row * 8 + 1;
    const off = (row % 2) * 8;
    for (let i = -1; i < 3; i++) {
      const xx = x + off + i * 16 + 1;
      const x0 = Math.max(x + 1, xx);
      const x1 = Math.min(x + TILE - 1, xx + 14);
      if (x1 <= x0) continue;
      ctx.fillStyle = base;
      ctx.fillRect(x0, yy, x1 - x0, 6);
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fillRect(x0, yy, x1 - x0, 1);
    }
  }
}

function drawWalls(ctx, game, cam) {
  const b = visibleBounds(game, cam);
  for (let r = b.r0; r <= b.r1; r++) {
    for (let c = b.c0; c <= b.c1; c++) {
      if (!isWall(game.map, c, r)) continue;
      drawBrick(ctx, c * TILE, r * TILE, c * 7 + r * 13);
    }
  }
}

function drawItemGlyph(ctx, type, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;
  if (type === 'laser') {
    ctx.beginPath();
    ctx.moveTo(-7, 0);
    ctx.lineTo(7, 0);
    ctx.stroke();
  } else if (type === 'pierce') {
    ctx.fillRect(-2, -8, 4, 16);
  } else if (type === 'shotgun') {
    ctx.fillRect(-8, -2, 4, 4);
    ctx.fillRect(-2, -2, 4, 4);
    ctx.fillRect(4, -2, 4, 4);
  } else if (type === 'rapid') {
    ctx.beginPath();
    ctx.moveTo(-7, -6);
    ctx.lineTo(-1, 0);
    ctx.lineTo(-7, 6);
    ctx.moveTo(1, -6);
    ctx.lineTo(7, 0);
    ctx.lineTo(1, 6);
    ctx.stroke();
  } else if (type === 'shield') {
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.stroke();
  } else if (type === 'thorns') {
    ctx.beginPath();
    ctx.moveTo(-7, -7);
    ctx.lineTo(7, 7);
    ctx.moveTo(7, -7);
    ctx.lineTo(-7, 7);
    ctx.stroke();
  }
}

function drawItems(ctx, game, now) {
  for (const it of game.items) {
    const w = WEAPONS[it.type];
    const pulse = 0.5 + Math.sin(now / 150 + it.x) * 0.5;
    const s = 22;
    ctx.save();
    ctx.translate(Math.round(it.x), Math.round(it.y));
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-s / 2 - 3, -s / 2 - 3, s + 6, s + 6);
    ctx.globalAlpha = 0.6 + pulse * 0.4;
    ctx.strokeStyle = w.color;
    ctx.lineWidth = 2;
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    drawItemGlyph(ctx, it.type, w.color);
    const left = Math.max(0, (it.expiresAt - now) / ITEM_LIFE_MS);
    ctx.globalAlpha = 1;
    ctx.fillStyle = w.color;
    ctx.fillRect(-s / 2, s / 2 + 2, s * left, 2);
    ctx.restore();
  }
}

function drawTank(ctx, t, now) {
  const s = TANK;
  const [dx, dy] = DIRS[t.dir];
  const angle = Math.atan2(dy, dx) + Math.PI / 2;
  const cx = Math.round(t.x);
  const cy = Math.round(t.y);
  const half = s / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  ctx.fillStyle = shade(t.color, -0.55);
  ctx.fillRect(-half, -half + 1, 5, s - 2);
  ctx.fillRect(half - 5, -half + 1, 5, s - 2);
  ctx.fillStyle = t.color;
  ctx.fillRect(-half + 5, -half + 5, s - 10, s - 10);
  ctx.fillStyle = shade(t.color, 0.28);
  ctx.fillRect(-half + 8, -half + 8, s - 16, s - 16);
  ctx.fillStyle = shade(t.color, -0.75);
  ctx.fillRect(-3, -half - 6, 6, half + 6);
  if (t.isPlayer) {
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-half + 0.5, -half + 0.5, s - 1, s - 1);
  }
  ctx.restore();

  if (t.shieldUntil > now) {
    ctx.strokeStyle = `rgba(122,162,255,${0.45 + Math.sin(now / 90) * 0.25})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, half + 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (t.thornsUntil > now) {
    ctx.strokeStyle = `rgba(255,138,92,${0.5 + Math.sin(now / 120) * 0.25})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(cx, cy, half + 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (t.flashUntil > now) {
    ctx.globalAlpha = Math.max(0, (t.flashUntil - now) / 110) * 0.8;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - half, cy - half, s, s);
    ctx.globalAlpha = 1;
  }
  if (t.chargeAt) {
    const p = Math.min(1, (now - t.chargeAt) / WEAPONS.pierce.chargeMs);
    ctx.strokeStyle = WEAPONS.pierce.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, half + 8, -Math.PI / 2, -Math.PI / 2 + p * Math.PI * 2);
    ctx.stroke();
  }
}

function drawBullets(ctx, game) {
  for (const b of game.bullets) {
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = b.color;
    ctx.fillRect(Math.round(b.x) - 5, Math.round(b.y) - 5, 10, 10);
    ctx.globalAlpha = 1;
    ctx.fillRect(Math.round(b.x) - 3, Math.round(b.y) - 3, 6, 6);
  }
}

function drawEffects(ctx, game) {
  for (const e of game.effects) {
    const life = Math.max(0, (e.until - game.now) / 500);
    if (life <= 0) continue;
    ctx.globalAlpha = Math.min(1, life * 1.6);
    ctx.strokeStyle = e.color;
    ctx.lineWidth = e.width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    e.points.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    if (e.width > 8) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = Math.max(2, e.width * 0.25);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function drawBlasts(ctx, game) {
  for (const e of game.explosions) {
    const p = Math.min(1, (game.now - e.at) / 420);
    if (p >= 1) continue;
    const r = 6 + p * 30;
    ctx.globalAlpha = 1 - p;
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(Math.round(e.x - r / 2), Math.round(e.y - r / 2), r, r);
    ctx.strokeStyle = '#ff7b54';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawItemPointers(ctx, game) {
  const cx = VIEW_W / 2;
  const cy = VIEW_H / 2;
  for (const it of game.items) {
    const sx = it.x - game.cam.x;
    const sy = it.y - game.cam.y;
    if (sx >= 0 && sy >= 0 && sx <= VIEW_W && sy <= VIEW_H) continue;
    const ang = Math.atan2(sy - cy, sx - cx);
    const hw = VIEW_W / 2 - 18;
    const hh = VIEW_H / 2 - 18;
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const scale = Math.min(Math.abs(cos) > 1e-6 ? hw / Math.abs(cos) : Infinity, Math.abs(sin) > 1e-6 ? hh / Math.abs(sin) : Infinity);
    ctx.save();
    ctx.translate(cx + cos * scale, cy + sin * scale);
    ctx.rotate(ang);
    ctx.globalAlpha = 0.55 + Math.sin(game.now / 200) * 0.35;
    ctx.fillStyle = WEAPONS[it.type].color;
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(-6, -7);
    ctx.lineTo(-6, 7);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

export function drawScene(ctx, game) {
  const cam = game.cam;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#07070c';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const sx = game.shake ? (Math.random() - 0.5) * game.shake : 0;
  const sy = game.shake ? (Math.random() - 0.5) * game.shake : 0;
  ctx.translate(-Math.round(cam.x) + sx, -Math.round(cam.y) + sy);
  drawFloor(ctx, game, cam);
  drawWalls(ctx, game, cam);
  drawItems(ctx, game, game.now);
  drawEffects(ctx, game);
  for (const t of game.tanks) if (t.alive) drawTank(ctx, t, game.now);
  drawBullets(ctx, game);
  drawBlasts(ctx, game);
  ctx.restore();
  drawItemPointers(ctx, game);
}

export function drawMinimap(mctx, game) {
  const W = mctx.canvas.width;
  const H = mctx.canvas.height;
  const map = game.map;
  const sx = W / map.cols;
  const sy = H / map.rows;
  mctx.clearRect(0, 0, W, H);
  mctx.fillStyle = '#07070c';
  mctx.fillRect(0, 0, W, H);
  mctx.fillStyle = '#4a2a20';
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      if (!isWall(map, c, r)) continue;
      mctx.fillRect(c * sx, r * sy, Math.max(1, sx), Math.max(1, sy));
    }
  }
  for (const it of game.items) {
    mctx.globalAlpha = 0.65 + Math.sin(game.now / 200) * 0.35;
    mctx.fillStyle = WEAPONS[it.type].color;
    mctx.fillRect((it.x / TILE) * sx - 2, (it.y / TILE) * sy - 2, 4, 4);
    mctx.globalAlpha = 1;
  }
  for (const t of game.tanks) {
    if (!t.alive) continue;
    mctx.fillStyle = t.isPlayer ? '#7bd88f' : '#ff6b6b';
    const s = t.isPlayer ? 4 : 2.5;
    mctx.fillRect((t.x / TILE) * sx - s / 2, (t.y / TILE) * sy - s / 2, s, s);
  }
  if (game.state === 'playing' && (game.width > VIEW_W || game.height > VIEW_H)) {
    mctx.strokeStyle = 'rgba(255,255,255,0.28)';
    mctx.lineWidth = 1;
    mctx.strokeRect(
      (game.cam.x / TILE) * sx + 0.5,
      (game.cam.y / TILE) * sy + 0.5,
      (VIEW_W / TILE) * sx,
      (VIEW_H / TILE) * sy
    );
  }
}
