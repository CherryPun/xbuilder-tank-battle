import assert from 'node:assert/strict';
import { TILE, TANK, BASE_COLS, BASE_ROWS, PLAYERS, WEAPONS, DEFAULT_BOUNCE, DIRS, dirFromAxes } from '../src/config.js';
import {
  createMap,
  spawnTiles,
  reachableSet,
  isWall,
  setTile,
  tileCenter,
  rectHitsWall,
  reflectAxes,
} from '../src/map.js';
import { Tank, Bullet } from '../src/entities.js';
import { tickFire, applyItem, expireWeapons } from '../src/weapons.js';

function blankMap(cols, rows) {
  const map = { cols, rows, tiles: new Uint8Array(cols * rows) };
  for (let c = 0; c < cols; c++) {
    setTile(map, c, 0, 1);
    setTile(map, c, rows - 1, 1);
  }
  for (let r = 0; r < rows; r++) {
    setTile(map, 0, r, 1);
    setTile(map, cols - 1, r, 1);
  }
  return map;
}

function fakeGame(map, tanks) {
  return {
    map,
    width: map.cols * TILE,
    height: map.rows * TILE,
    tanks,
    bullets: [],
    effects: [],
    now: 1000,
    shake: 0,
    hits: [],
    hitTank(target, attacker) {
      this.hits.push({ target, attacker });
    },
  };
}

assert.equal(PLAYERS[2].scale, 2);
assert.equal(PLAYERS[4].scale, 4);
assert.equal(PLAYERS[8].scale, 6);

for (const count of [2, 4, 8]) {
  const { scale } = PLAYERS[count];
  for (let seed = 0; seed < 12; seed++) {
    const map = createMap(BASE_COLS * scale, BASE_ROWS * scale);
    const spawns = spawnTiles(map, count);
    const seen = reachableSet(map, spawns[0]);
    for (const s of spawns) {
      assert.ok(seen.has(s.r * map.cols + s.c), `spawn unreachable: ${count}p seed ${seed}`);
    }
    for (const s of spawns) {
      const p = tileCenter(map, s.c, s.r);
      assert.ok(!rectHitsWall(map, p.x, p.y, TANK), 'spawn overlaps wall');
    }
  }
}

const map = blankMap(12, 6);
const tank = new Tank(TILE * 2 + 16, TILE * 2 + 16, { isPlayer: true });
tank.dir = 1;
const game = fakeGame(map, [tank]);

tank.weapon = { type: 'laser', usesLeft: 3, expiresAt: 0 };
tickFire(game, tank, game.now, true);
assert.equal(game.effects.length, 1);
assert.equal(game.effects[0].points.length, 6, 'laser should stop after 4 bounces on 5th wall');
assert.equal(tank.weapon.usesLeft, 2, 'laser consumes one use');

const t2 = new Tank(TILE * 4 + 16, TILE * 2 + 16, {});
const game2 = fakeGame(blankMap(12, 6), [tank, t2]);
tank.weapon = { type: 'laser', usesLeft: 1, expiresAt: 0 };
tank.dir = 1;
tank.fireAt = 0;
tickFire(game2, tank, game2.now, true);
assert.equal(game2.hits.length, 1, 'laser kills the first tank on its path');
assert.equal(game2.hits[0].target, t2);
assert.equal(tank.weapon, null, 'last laser use clears the weapon');

const pmap = blankMap(12, 6);
setTile(pmap, 6, 2, 1);
setTile(pmap, 6, 3, 1);
const pTank = new Tank(TILE * 2 + 16, TILE * 2 + 16, {});
const behind = new Tank(TILE * 8 + 16, TILE * 2 + 16, {});
const pgame = fakeGame(pmap, [pTank, behind]);
pTank.weapon = { type: 'pierce', usesLeft: 1, expiresAt: 0 };
pTank.dir = 1;
tickFire(pgame, pTank, pgame.now, true);
assert.equal(isWall(pmap, 6, 2), true, 'pierce needs charge time before firing');
tickFire(pgame, pTank, pgame.now + WEAPONS.pierce.chargeMs, true);
assert.equal(isWall(pmap, 6, 2), false, 'pierce destroys walls in its band');
assert.equal(pgame.hits.length, 1, 'pierce kills tanks behind walls');
assert.equal(pTank.weapon, null, 'pierce is single use');

const smap = blankMap(12, 6);
const sTank = new Tank(TILE * 2 + 16, TILE * 2 + 16, {});
const sgame = fakeGame(smap, [sTank]);
sTank.weapon = { type: 'shotgun', usesLeft: 5, expiresAt: 0 };
sTank.dir = 1;
tickFire(sgame, sTank, sgame.now, true);
assert.equal(sgame.bullets.length, 3, 'shotgun fires 3 pellets');
assert.ok(sgame.bullets.every((b) => b.bounce === 6));
assert.equal(sTank.weapon.usesLeft, 4);

const rTank = new Tank(TILE * 2 + 16, TILE * 2 + 16, {});
const rgame = fakeGame(blankMap(12, 6), [rTank]);
rTank.weapon = { type: 'rapid', usesLeft: Infinity, expiresAt: rTank.fireAt + 10000 };
rTank.dir = 1;
tickFire(rgame, rTank, 1000, true);
assert.equal(rgame.bullets.length, 1);
rTank.wantShoot = false;
tickFire(rgame, rTank, 1100, true);
assert.equal(rgame.bullets.length, 1, 'rapid respects 0.3s interval');
tickFire(rgame, rTank, 1301, true);
assert.equal(rgame.bullets.length, 2, 'rapid fires again after 0.3s');

const buffTank = new Tank(0, 0, {});
applyItem(buffTank, 'shield', 5000);
assert.equal(buffTank.shieldUntil, 15000);
applyItem(buffTank, 'thorns', 5000);
assert.equal(buffTank.thornsUntil, 15000);
applyItem(buffTank, 'laser', 5000);
assert.equal(buffTank.weapon.type, 'laser');
assert.equal(buffTank.weapon.usesLeft, 3);
applyItem(buffTank, 'rapid', 5000);
assert.equal(buffTank.weapon.expiresAt, 15000);
expireWeapons([buffTank], 16000);
assert.equal(buffTank.weapon, null, 'timed weapon expires');

const wallTank = new Tank(TILE * 5 + 16, TILE * 5 + 16, {});
assert.equal(wallTank.canBeAt(TILE * 1.5, TILE * 5 + 16, map, [wallTank]), false, 'tank blocked by wall');

const bullet = new Bullet(TILE * 1.5, TILE * 2 + 16, 0, { owner: tank, bounce: 0 });
const bgame = fakeGame(blankMap(12, 6), [tank]);
bgame.bullets = [bullet];
assert.equal(bgame.bullets.length, 1);

const dBullet = new Bullet(TILE * 1.5, TILE * 2 + 16, 0, { owner: tank, bounce: 0 });
assert.equal(dBullet.vx, 0);
assert.equal(dBullet.vy, -1);
assert.equal(Bullet.name.length > 0, true);

const defaultTank = new Tank(TILE * 2 + 16, TILE * 2 + 16, {});
const defaultGame = fakeGame(blankMap(12, 6), [defaultTank]);
defaultTank.dir = 1;
tickFire(defaultGame, defaultTank, 1000, true);
assert.equal(defaultGame.bullets[0].bounce, DEFAULT_BOUNCE, 'default bullet bounces 4 times');

const axisMap = blankMap(12, 6);
assert.deepEqual(reflectAxes(axisMap, 10.5 * TILE, 3 * TILE, 11.2 * TILE, 3 * TILE), { hx: true, hy: false });
assert.deepEqual(reflectAxes(axisMap, 3 * TILE, 3 * TILE, 3 * TILE, 0.5 * TILE), { hx: false, hy: true });
assert.deepEqual(reflectAxes(axisMap, 1.5 * TILE, 1.5 * TILE, 0.5 * TILE, 0.5 * TILE), { hx: true, hy: true });

assert.equal(DIRS.length, 8, 'eight firing directions');
assert.ok(Math.abs(Math.hypot(...DIRS[4]) - 1) < 1e-9, 'diagonal directions are normalized');

const diagMap = blankMap(12, 8);
const diagTank = new Tank(TILE * 5, TILE * 4, {});
diagTank.step(4, 10, diagMap, [diagTank]);
assert.ok(Math.abs(diagTank.x - TILE * 5 - 10 / Math.SQRT2) < 1e-6);
assert.ok(Math.abs(diagTank.y - TILE * 4 + 10 / Math.SQRT2) < 1e-6);

const smallMap = createMap(BASE_COLS * PLAYERS[2].scale, BASE_ROWS * PLAYERS[2].scale);
assert.equal(smallMap.cols, 16);
assert.equal(smallMap.rows, 14);

const axisCases = [
  [0, -1, 0],
  [1, 0, 1],
  [0, 1, 2],
  [-1, 0, 3],
  [1, -1, 4],
  [1, 1, 5],
  [-1, 1, 6],
  [-1, -1, 7],
  [0, 0, -1],
];
for (const [vx, vy, expected] of axisCases) {
  const dir = dirFromAxes(vx, vy);
  assert.equal(dir, expected, `dirFromAxes(${vx},${vy})`);
  if (dir >= 0) {
    const [dx, dy] = DIRS[dir];
    assert.ok(Math.sign(dx) === Math.sign(vx) && Math.sign(dy) === Math.sign(vy), `dir ${dir} matches axes ${vx},${vy}`);
  }
}

console.log('smoke ok');
