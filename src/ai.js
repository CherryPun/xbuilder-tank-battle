import { DIRS, TILE, TANK, OPPOSITE } from './config.js';
import { isWall } from './map.js';

function losClear(map, ax, ay, bx, by) {
  const dist = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i <= steps; i++) {
    const x = ax + ((bx - ax) * i) / steps;
    const y = ay + ((by - ay) * i) / steps;
    if (isWall(map, Math.floor(x / TILE), Math.floor(y / TILE))) return false;
  }
  return true;
}

function nearestDir(dx, dy) {
  const ang = Math.atan2(dy, dx);
  let best = 0;
  let diff = Math.PI;
  for (let d = 0; d < 8; d++) {
    let delta = Math.abs(Math.atan2(DIRS[d][1], DIRS[d][0]) - ang);
    if (delta > Math.PI) delta = Math.PI * 2 - delta;
    if (delta < diff) {
      diff = delta;
      best = d;
    }
  }
  return { dir: best, diff };
}

function pickDir(game, bot, target) {
  const pref = nearestDir(target.x - bot.x, target.y - bot.y).dir;
  const opts = [];
  for (let d = 0; d < 8; d++) {
    const [dx, dy] = DIRS[d];
    const nx = bot.x + dx * (TANK / 2 + 4);
    const ny = bot.y + dy * (TANK / 2 + 4);
    if (bot.canBeAt(nx, ny, game.map, game.tanks)) opts.push(d);
  }
  if (!opts.length) return OPPOSITE[bot.dir];
  if (opts.includes(pref) && Math.random() < 0.65) return pref;
  return opts[(Math.random() * opts.length) | 0];
}

export function updateBot(game, bot, dt, now) {
  if (!bot.ai) {
    bot.ai = { dir: (Math.random() * 8) | 0, until: 0, stuck: 0, nextShot: 0 };
  }
  const ai = bot.ai;
  const target = game.player;
  bot.wantShoot = false;
  if (!target || !target.alive) return;

  const dx = target.x - bot.x;
  const dy = target.y - bot.y;
  const aim = nearestDir(dx, dy);

  if (aim.diff < 0.22 && losClear(game.map, bot.x, bot.y, target.x, target.y)) {
    bot.dir = aim.dir;
    if (bot.weapon && bot.weapon.type === 'pierce') {
      bot.wantShoot = true;
      return;
    }
    if (now > ai.nextShot) {
      bot.wantShoot = true;
      ai.nextShot = now + 900 + Math.random() * 900;
    }
    return;
  }

  if (now > ai.until) {
    ai.dir = pickDir(game, bot, target);
    ai.until = now + 600 + Math.random() * 900;
  }

  const px = bot.x;
  const py = bot.y;
  bot.step(ai.dir, bot.speed() * (dt / 1000), game.map, game.tanks);
  if (Math.abs(bot.x - px) + Math.abs(bot.y - py) < 0.2) {
    ai.stuck += dt;
    if (ai.stuck > 220) {
      ai.dir = pickDir(game, bot, target);
      ai.until = now + 500;
      ai.stuck = 0;
    }
  } else {
    ai.stuck = 0;
  }

  if (Math.random() < 0.004 && now > ai.nextShot) {
    bot.wantShoot = true;
    ai.nextShot = now + 1500;
  }
}
