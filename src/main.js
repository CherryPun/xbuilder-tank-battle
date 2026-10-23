import {
  VIEW_W,
  VIEW_H,
  TILE,
  TANK,
  BASE_COLS,
  BASE_ROWS,
  PLAYERS,
  MODES,
  WEAPONS,
  ITEM_TYPES,
  ITEM_SPAWN_MS,
  BOT_SPAWN_MS,
  BOT_COLORS,
  PLAYER_COLOR,
  BOT_SPEED,
  TANK_TYPES,
  dirFromAxes,
} from './config.js';
import { createMap, spawnTiles, tileCenter, wallAt, reflectAxes, reachableSet, randomEmptyTile } from './map.js';
import { Tank, Item } from './entities.js';
import { tickFire, applyItem, expireWeapons } from './weapons.js';
import { updateBot } from './ai.js';
import { drawScene, drawMinimap } from './render.js';

const AXIS_KEYS = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};
const pressed = new Map();
let fireHeld = false;

function currentDir() {
  let up = 0;
  let down = 0;
  let left = 0;
  let right = 0;
  for (const axis of pressed.values()) {
    if (axis === 'up') up = 1;
    else if (axis === 'down') down = 1;
    else if (axis === 'left') left = 1;
    else if (axis === 'right') right = 1;
  }
  return dirFromAxes(right - left, down - up);
}

class Game {
  constructor(ctx, mctx) {
    this.ctx = ctx;
    this.mctx = mctx;
    this.state = 'menu';
    this.tanks = [];
    this.bullets = [];
    this.items = [];
    this.effects = [];
    this.explosions = [];
    this.now = 0;
    this.cam = { x: 0, y: 0 };
    this.shake = 0;
    this.mode = 'classic';
    this.playerCount = 2;
    this.kills = 0;
    this.result = '';
    this.itemTimer = 0;
    this.spawnTimer = 0;
    this.startedAt = 0;
    this.godMode = false;
  }

  start(playerCount, mode, playerType = 'balance') {
    this.playerCount = playerCount;
    this.mode = mode;
    this.playerType = TANK_TYPES[playerType] ? playerType : 'balance';
    const { scale, bots } = PLAYERS[playerCount];
    const cols = BASE_COLS * scale;
    const rows = BASE_ROWS * scale;
    let map;
    let spawns;
    for (let attempt = 0; attempt < 40; attempt++) {
      map = createMap(cols, rows);
      spawns = spawnTiles(map, 1);
      const seen = reachableSet(map, spawns[0]);
      if (seen.size > cols * rows * 0.5) break;
    }
    this.map = map;
    this.width = cols * TILE;
    this.height = rows * TILE;
    this.bullets = [];
    this.items = [];
    this.effects = [];
    this.explosions = [];
    this.tanks = [];
    this.kills = 0;
    this.result = '';
    this.shake = 0;
    this.botCap = bots;

    const home = tileCenter(map, spawns[0].c, spawns[0].r);
    this.player = new Tank(home.x, home.y, {
      isPlayer: true,
      color: PLAYER_COLOR,
      name: '你',
      type: this.playerType,
    });
    this.tanks.push(this.player);
    const placed = [{ x: home.x, y: home.y }];
    for (let i = 0; i < bots; i++) {
      const pos =
        randomEmptyTile(map, placed, TILE * 5) ||
        randomEmptyTile(map, placed, TILE * 2) ||
        randomEmptyTile(map);
      if (!pos) break;
      placed.push(pos);
      this.tanks.push(
        new Tank(pos.x, pos.y, {
          color: BOT_COLORS[i % BOT_COLORS.length],
          name: `AI-${i + 1}`,
          type: 'balance',
          speed: BOT_SPEED,
        })
      );
    }

    this.startedAt = performance.now();
    this.now = this.startedAt;
    this.itemTimer = this.startedAt;
    this.spawnTimer = this.startedAt;
    this.state = 'playing';
    this.updateCamera();
  }

  aliveBots() {
    return this.tanks.filter((t) => t.alive && !t.isPlayer).length;
  }

  updateCamera() {
    const p = this.player;
    if (!p) return;
    this.cam.x =
      this.width <= VIEW_W
        ? (this.width - VIEW_W) / 2
        : Math.max(0, Math.min(this.width - VIEW_W, p.x - VIEW_W / 2));
    this.cam.y =
      this.height <= VIEW_H
        ? (this.height - VIEW_H) / 2
        : Math.max(0, Math.min(this.height - VIEW_H, p.y - VIEW_H / 2));
  }

  update(dt, now) {
    this.now = now;
    if (this.state !== 'playing') return;
    const sec = dt / 1000;
    const p = this.player;

    if (p.alive) {
      const d = currentDir();
      if (d >= 0) p.step(d, p.speed() * sec, this.map, this.tanks);
      tickFire(this, p, now, fireHeld);
    }
    for (const t of this.tanks) {
      if (!t.alive || t.isPlayer) continue;
      updateBot(this, t, dt, now);
      tickFire(this, t, now, t.wantShoot);
    }
    expireWeapons(this.tanks, now);
    this.updateBullets(dt);
    this.updateItems(now);
    this.updateSpawns(now);
    this.effects = this.effects.filter((e) => e.until > now);
    this.explosions = this.explosions.filter((e) => now - e.at < 450);
    this.shake = Math.max(0, this.shake - dt * 0.03);
    this.updateCamera();
    this.checkWin();
  }

  updateBullets(dt) {
    const sec = dt / 1000;
    for (const b of this.bullets) {
      if (!b.alive) continue;
      let remain = b.speed * sec;
      let guard = 0;
      while (remain > 0 && b.alive && guard++ < 240) {
        const step = Math.min(4, remain);
        remain -= step;
        const nx = b.x + b.vx * step;
        const ny = b.y + b.vy * step;
        if (wallAt(this.map, nx, ny)) {
          if (b.bounce > 0) {
            const { hx, hy } = reflectAxes(this.map, b.x, b.y, nx, ny);
            if (hx) b.vx = -b.vx;
            if (hy) b.vy = -b.vy;
            b.bounce -= 1;
            continue;
          }
          b.alive = false;
          break;
        }
        b.x = nx;
        b.y = ny;
        for (const t of this.tanks) {
          if (!t.alive || t === b.owner) continue;
          if (Math.abs(t.x - b.x) <= TANK / 2 && Math.abs(t.y - b.y) <= TANK / 2) {
            b.alive = false;
            this.hitTank(t, b.owner, b.damage);
            break;
          }
        }
      }
    }
    this.bullets = this.bullets.filter((b) => b.alive);
  }

  hitTank(target, attacker, damage = attacker ? attacker.damage : 1) {
    if (!target.alive) return;
    if (target.isPlayer && this.godMode) return;
    if (target.shieldUntil > this.now) return;
    if (target.thornsUntil > this.now) {
      if (attacker && attacker !== target && attacker.alive) this.damageTank(attacker, damage, target);
      return;
    }
    this.damageTank(target, damage, attacker);
  }

  damageTank(t, amount, killer) {
    if (!t.alive || !(amount > 0)) return;
    if (t.isPlayer && this.godMode) return;
    if (t.shieldUntil > this.now) return;
    t.hp = Math.max(0, t.hp - amount);
    t.flashUntil = this.now + 110;
    if (t.hp > 0) return;
    this.killTank(t, killer);
  }

  killTank(t, killer) {
    if (!t.alive) return;
    if (t.isPlayer && this.godMode) return;
    if (t.shieldUntil > this.now) return;
    t.hp = 0;
    t.alive = false;
    t.weapon = null;
    t.chargeAt = 0;
    this.explosions.push({ x: t.x, y: t.y, at: this.now });
    this.shake = Math.max(this.shake, t.isPlayer ? 9 : 4);
    if (t.isPlayer) {
      this.end('lose');
      return;
    }
    if (killer && killer.isPlayer) this.kills += 1;
  }

  updateItems(now) {
    if (now - this.itemTimer >= ITEM_SPAWN_MS) {
      this.itemTimer = now;
      this.spawnItem(now);
    }
    for (const it of this.items) {
      if (now > it.expiresAt) {
        it.dead = true;
        continue;
      }
      for (const t of this.tanks) {
        if (!t.alive) continue;
        if (Math.abs(t.x - it.x) < TANK * 0.85 && Math.abs(t.y - it.y) < TANK * 0.85) {
          applyItem(t, it.type, now);
          it.dead = true;
          this.effects.push({
            points: [
              { x: it.x - 12, y: it.y },
              { x: it.x + 12, y: it.y },
            ],
            until: now + 240,
            color: WEAPONS[it.type].color,
            width: 4,
          });
          break;
        }
      }
    }
    this.items = this.items.filter((it) => !it.dead);
  }

  spawnItem(now) {
    const avoid = this.tanks.filter((t) => t.alive).map((t) => ({ x: t.x, y: t.y }));
    const pos = randomEmptyTile(this.map, avoid, TILE * 3);
    if (!pos) return;
    const type = ITEM_TYPES[(Math.random() * ITEM_TYPES.length) | 0];
    this.items.push(new Item(pos.x, pos.y, type, now));
  }

  updateSpawns(now) {
    if (this.mode !== 'rogue') return;
    if (now - this.spawnTimer < BOT_SPAWN_MS) return;
    this.spawnTimer = now;
    while (this.aliveBots() < this.botCap) {
      const before = this.tanks.length;
      this.spawnBot();
      if (this.tanks.length === before) break;
    }
  }

  spawnBot() {
    const avoid = this.tanks.filter((t) => t.alive).map((t) => ({ x: t.x, y: t.y }));
    const pos = randomEmptyTile(this.map, avoid, TILE * 4) || randomEmptyTile(this.map, avoid, TILE * 2);
    if (!pos) return;
    this.tanks.push(
      new Tank(pos.x, pos.y, {
        color: BOT_COLORS[this.tanks.length % BOT_COLORS.length],
        name: 'AI',
        type: 'balance',
        speed: BOT_SPEED,
      })
    );
  }

  checkWin() {
    if (this.state !== 'playing') return;
    if (this.mode === 'classic' && this.aliveBots() === 0) this.end('win');
  }

  end(result) {
    if (this.state !== 'playing') return;
    this.result = result;
    this.state = 'over';
    showResult(this);
  }
}

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const mini = document.getElementById('minimap');
const mctx = mini.getContext('2d');
const game = new Game(ctx, mctx);

const menuEl = document.getElementById('menu');
const overEl = document.getElementById('over');
const pauseEl = document.getElementById('pause');
const hudEl = document.getElementById('hud');
const hudTop = document.getElementById('hud-top');
const hudEquip = document.getElementById('hud-equip');
const hudWave = document.getElementById('hud-wave');

let pickedMode = 'classic';
let pickedPlayers = 2;
let pickedType = 'balance';

document.querySelectorAll('[data-mode]').forEach((btn) => {
  btn.addEventListener('click', () => {
    pickedMode = btn.dataset.mode;
    document.querySelectorAll('[data-mode]').forEach((x) => x.classList.toggle('on', x === btn));
  });
});

document.querySelectorAll('[data-players]').forEach((btn) => {
  btn.addEventListener('click', () => {
    pickedPlayers = Number(btn.dataset.players);
    document.querySelectorAll('[data-players]').forEach((x) => x.classList.toggle('on', x === btn));
  });
});

document.querySelectorAll('[data-type]').forEach((btn) => {
  btn.addEventListener('click', () => {
    pickedType = btn.dataset.type;
    document.querySelectorAll('[data-type]').forEach((x) => x.classList.toggle('on', x === btn));
    const preset = TANK_TYPES[pickedType];
    document.getElementById('typeDesc').textContent = preset.desc;
  });
});

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('againBtn').addEventListener('click', startGame);
document.getElementById('menuBtn').addEventListener('click', toMenu);
document.getElementById('resumeBtn').addEventListener('click', togglePause);
document.getElementById('pauseRestartBtn').addEventListener('click', startGame);
document.getElementById('pauseMenuBtn').addEventListener('click', toMenu);

function startGame() {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  menuEl.classList.add('hidden');
  overEl.classList.add('hidden');
  pauseEl.classList.add('hidden');
  hudEl.classList.remove('hidden');
  game.start(pickedPlayers, pickedMode, pickedType);
}

function toMenu() {
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  game.state = 'menu';
  pauseEl.classList.add('hidden');
  overEl.classList.add('hidden');
  hudEl.classList.add('hidden');
  menuEl.classList.remove('hidden');
}

function togglePause() {
  if (game.state === 'playing') {
    game.state = 'paused';
    if (game.player) game.player.chargeAt = 0;
    pauseEl.classList.remove('hidden');
  } else if (game.state === 'paused') {
    game.state = 'playing';
    pauseEl.classList.add('hidden');
  }
}

function showResult(g) {
  const time = Math.max(1, Math.round((g.now - g.startedAt) / 1000));
  document.getElementById('resultTitle').textContent = g.result === 'win' ? '全歼人机 · 胜利' : '坦克被击毁';
  document.getElementById('resultStats').textContent =
    `击杀 ${g.kills} · 用时 ${time} 秒 · ${MODES[g.mode].label} / ${PLAYERS[g.playerCount].label}`;
  hudEl.classList.add('hidden');
  overEl.classList.remove('hidden');
}

const KONAMI = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'KeyB',
  'KeyA',
  'KeyB',
  'KeyA',
];
let konamiIndex = 0;
let toastTimer = 0;

function showToast(text) {
  const el = document.getElementById('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}

function toggleGodMode() {
  game.godMode = !game.godMode;
  showToast(game.godMode ? '彩蛋：无敌模式已开启' : '彩蛋：无敌模式已关闭');
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') {
    e.preventDefault();
    togglePause();
    return;
  }
  if (game.state === 'menu') {
    if (e.code === KONAMI[konamiIndex]) {
      konamiIndex += 1;
      if (konamiIndex === KONAMI.length) {
        konamiIndex = 0;
        toggleGodMode();
      }
    } else {
      konamiIndex = e.code === KONAMI[0] ? 1 : 0;
    }
    return;
  }
  if (game.state !== 'playing') return;
  if (e.code === 'KeyJ' || e.code === 'Space') {
    fireHeld = true;
    e.preventDefault();
    return;
  }
  const axis = AXIS_KEYS[e.code];
  if (!axis) return;
  e.preventDefault();
  pressed.set(e.code, axis);
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyJ' || e.code === 'Space') {
    fireHeld = false;
    return;
  }
  if (!AXIS_KEYS[e.code]) return;
  pressed.delete(e.code);
});

window.addEventListener('blur', () => {
  pressed.clear();
  fireHeld = false;
});

function updateHud(g) {
  const p = g.player;
  hudTop.innerHTML = `<b>${MODES[g.mode].label}</b> · ${PLAYERS[g.playerCount].label}<br>人机 ${g.aliveBots()}/${g.botCap} · 击杀 ${g.kills}`;
  const preset = TANK_TYPES[p.type];
  const hpPips = '■'.repeat(Math.max(0, Math.ceil(p.hp))) + '□'.repeat(Math.max(0, p.maxHp - Math.ceil(p.hp)));
  const lines = [];
  if (!p.alive) {
    lines.push('已阵亡');
  } else {
    if (p.weapon) {
      const w = WEAPONS[p.weapon.type];
      lines.push(
        p.weapon.expiresAt
          ? `${w.name} ${Math.ceil((p.weapon.expiresAt - g.now) / 1000)}s`
          : `${w.name} ×${p.weapon.usesLeft}`
      );
    } else {
      lines.push('默认弹丸 · 1.0s');
    }
    if (p.shieldUntil > g.now) lines.push(`无敌 ${Math.ceil((p.shieldUntil - g.now) / 1000)}s`);
    if (p.thornsUntil > g.now) lines.push(`反甲 ${Math.ceil((p.thornsUntil - g.now) / 1000)}s`);
    if (p.chargeAt) lines.push('穿透激光蓄力中…');
  }
  hudEquip.innerHTML = `<span class="lbl">${preset.label}</span> ${hpPips}<br>${lines.join('<br>')}`;
  const next = Math.max(0, Math.ceil((ITEM_SPAWN_MS - (g.now - g.itemTimer)) / 1000));
  hudWave.innerHTML = `装备刷新 ${next}s<br>场上 ${g.items.length}`;
}

let last = performance.now();

function frame(now) {
  const dt = Math.min(34, Math.max(0, now - last));
  last = now;
  game.update(dt, now);
  if (game.map) {
    drawScene(ctx, game);
    if (game.state === 'playing') {
      drawMinimap(mctx, game);
      updateHud(game);
    }
  }
window.__tankGame = game;
requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
