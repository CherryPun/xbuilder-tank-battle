import { DIRS, TANK, TANK_TYPES, BULLET_SPEED, DEFAULT_FIRE_MS, WEAPONS, ITEM_LIFE_MS } from './config.js';
import { rectHitsWall } from './map.js';

export class Tank {
  constructor(x, y, { isPlayer = false, color = '#7bd88f', name = '坦克', type = 'balance', speed } = {}) {
    const preset = TANK_TYPES[type] || TANK_TYPES.balance;
    this.type = TANK_TYPES[type] ? type : 'balance';
    this.x = x;
    this.y = y;
    this.dir = 0;
    this.isPlayer = isPlayer;
    this.color = color;
    this.name = name;
    this.maxHp = preset.hp;
    this.hp = preset.hp;
    this.damage = preset.damage;
    this.baseSpeed = speed ?? preset.speed;
    this.alive = true;
    this.weapon = null;
    this.shieldUntil = 0;
    this.thornsUntil = 0;
    this.fireAt = 0;
    this.chargeAt = 0;
    this.wantShoot = false;
    this.ai = null;
    this.flashUntil = 0;
  }

  speed() {
    return this.baseSpeed;
  }

  fireInterval() {
    return this.weapon?.type === 'rapid' ? WEAPONS.rapid.fireMs : DEFAULT_FIRE_MS;
  }

  canBeAt(x, y, map, tanks) {
    if (rectHitsWall(map, x, y, TANK)) return false;
    for (const other of tanks) {
      if (other === this || !other.alive) continue;
      if (Math.abs(other.x - x) < TANK * 0.9 && Math.abs(other.y - y) < TANK * 0.9) return false;
    }
    return true;
  }

  step(dir, dist, map, tanks) {
    this.dir = dir;
    const [dx, dy] = DIRS[dir];
    let remain = dist;
    while (remain > 0) {
      const len = Math.min(remain, 6);
      remain -= len;
      if (dx) {
        const nx = this.x + dx * len;
        if (this.canBeAt(nx, this.y, map, tanks)) this.x = nx;
      }
      if (dy) {
        const ny = this.y + dy * len;
        if (this.canBeAt(this.x, ny, map, tanks)) this.y = ny;
      }
    }
  }
}

export class Bullet {
  constructor(x, y, dir, { owner, bounce = 0, color = '#ffe08a', damage = 1 } = {}) {
    this.x = x;
    this.y = y;
    this.dir = dir;
    this.vx = DIRS[dir][0];
    this.vy = DIRS[dir][1];
    this.owner = owner;
    this.bounce = bounce;
    this.color = color;
    this.damage = damage;
    this.speed = BULLET_SPEED;
    this.alive = true;
  }
}

export class Item {
  constructor(x, y, type, now) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.bornAt = now;
    this.expiresAt = now + ITEM_LIFE_MS;
    this.dead = false;
  }
}
