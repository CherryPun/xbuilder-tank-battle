import { DIRS, TILE, TANK, WEAPONS, BULLET_R, DEFAULT_BOUNCE } from './config.js';
import { isWall, destroyTile, wallAt, reflectAxes } from './map.js';
import { Bullet } from './entities.js';

const STEP = 4;

export function tickFire(game, tank, now, wantShoot) {
  if (!tank.alive) return;
  const w = tank.weapon;
  if (w && w.type === 'pierce') {
    if (!wantShoot) {
      tank.chargeAt = 0;
      return;
    }
    if (!tank.chargeAt) tank.chargeAt = now;
    if (now - tank.chargeAt >= WEAPONS.pierce.chargeMs) {
      tank.chargeAt = 0;
      firePierce(game, tank);
      consume(tank);
    }
    return;
  }
  if (!wantShoot || now < tank.fireAt) return;
  tank.fireAt = now + tank.fireInterval();
  if (w && w.type === 'laser') {
    fireLaser(game, tank);
    consume(tank);
    return;
  }
  if (w && w.type === 'shotgun') {
    fireShotgun(game, tank);
    consume(tank);
    return;
  }
  if (w && w.type === 'rapid') {
    spawnBullet(game, tank, WEAPONS.rapid.bounce, WEAPONS.rapid.color);
    return;
  }
  spawnBullet(game, tank, DEFAULT_BOUNCE, '#ffe08a');
}

function consume(tank) {
  const w = tank.weapon;
  if (!w || w.usesLeft === Infinity) return;
  w.usesLeft -= 1;
  if (w.usesLeft <= 0) tank.weapon = null;
}

function spawnBullet(game, tank, bounce, color, offset = 0) {
  const [dx, dy] = DIRS[tank.dir];
  const x = tank.x + dx * (TANK / 2 + BULLET_R) - dy * offset;
  const y = tank.y + dy * (TANK / 2 + BULLET_R) + dx * offset;
  game.bullets.push(new Bullet(x, y, tank.dir, { owner: tank, bounce, color }));
}

function fireShotgun(game, tank) {
  const spread = 9;
  for (let i = -1; i <= 1; i++) {
    spawnBullet(game, tank, WEAPONS.shotgun.bounce, WEAPONS.shotgun.color, i * spread);
  }
}

function hitTankAt(game, shooter, x, y) {
  for (const t of game.tanks) {
    if (!t.alive || t === shooter) continue;
    if (Math.abs(t.x - x) <= TANK / 2 && Math.abs(t.y - y) <= TANK / 2) return t;
  }
  return null;
}

function fireLaser(game, tank) {
  const points = [{ x: tank.x, y: tank.y }];
  let [vx, vy] = DIRS[tank.dir];
  let bounces = WEAPONS.laser.bounce;
  let x = tank.x;
  let y = tank.y;
  let victim = null;
  for (let i = 0; i < 8000; i++) {
    const nx = x + vx * STEP;
    const ny = y + vy * STEP;
    if (nx < 0 || ny < 0 || nx > game.width || ny > game.height) {
      points.push({ x: nx, y: ny });
      break;
    }
    if (wallAt(game.map, nx, ny)) {
      points.push({ x, y });
      if (bounces <= 0) break;
      const { hx, hy } = reflectAxes(game.map, x, y, nx, ny);
      if (hx) vx = -vx;
      if (hy) vy = -vy;
      bounces -= 1;
      continue;
    }
    x = nx;
    y = ny;
    const hit = hitTankAt(game, tank, x, y);
    if (hit) {
      points.push({ x, y });
      victim = hit;
      break;
    }
  }
  game.effects.push({ points, until: game.now + 500, color: WEAPONS.laser.color, width: 3 });
  if (victim) game.hitTank(victim, tank);
}

function firePierce(game, tank) {
  const [vx, vy] = DIRS[tank.dir];
  const half = TANK / 2;
  const reach = Math.hypot(game.width, game.height);
  const points = [
    { x: tank.x, y: tank.y },
    { x: tank.x + vx * reach, y: tank.y + vy * reach },
  ];
  for (let r = 0; r < game.map.rows; r++) {
    for (let c = 0; c < game.map.cols; c++) {
      if (!isWall(game.map, c, r)) continue;
      const cx = c * TILE + TILE / 2 - tank.x;
      const cy = r * TILE + TILE / 2 - tank.y;
      const proj = cx * vx + cy * vy;
      if (proj < 0) continue;
      if (Math.abs(cx * vy - cy * vx) <= half + TILE * 0.5) destroyTile(game.map, c, r);
    }
  }
  for (const t of game.tanks) {
    if (!t.alive || t === tank) continue;
    const cx = t.x - tank.x;
    const cy = t.y - tank.y;
    const proj = cx * vx + cy * vy;
    if (proj < 0) continue;
    if (Math.abs(cx * vy - cy * vx) <= half + TANK / 2) game.hitTank(t, tank);
  }
  game.effects.push({ points, until: game.now + 450, color: WEAPONS.pierce.color, width: TANK });
  game.shake = Math.max(game.shake, 7);
}

export function applyItem(tank, type, now) {
  const w = WEAPONS[type];
  if (w.kind === 'buff') {
    if (type === 'shield') tank.shieldUntil = now + w.duration;
    else tank.thornsUntil = now + w.duration;
    return;
  }
  tank.weapon = { type, usesLeft: w.uses, expiresAt: w.duration ? now + w.duration : 0 };
  tank.chargeAt = 0;
  tank.fireAt = 0;
}

export function expireWeapons(tanks, now) {
  for (const t of tanks) {
    if (t.weapon && t.weapon.expiresAt && now > t.weapon.expiresAt) t.weapon = null;
  }
}
