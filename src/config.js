export const TILE = 32;
export const TANK = 26;
export const VIEW_W = 640;
export const VIEW_H = 480;

export const BASE_COLS = 8;
export const BASE_ROWS = 7;

const RAW_DIRS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
];
export const DIRS = RAW_DIRS.map(([x, y]) => {
  const len = Math.hypot(x, y);
  return [x / len, y / len];
});
export const OPPOSITE = [2, 3, 0, 1, 6, 7, 4, 5];

const DIR_BY_AXIS = [
  [7, 0, 4],
  [3, -1, 1],
  [6, 2, 5],
];

export function dirFromAxes(vx, vy) {
  return DIR_BY_AXIS[vy + 1][vx + 1];
}

export const BOT_SPEED = 96;

export const TANK_TYPES = {
  balance: { label: '平衡型', hp: 1, damage: 1, speed: 120, desc: '1 血 · 标准速度 · 标准伤害' },
  speed: { label: '速度型', hp: 1, damage: 0.5, speed: 240, desc: '1 血 · 双倍速度 · 半伤' },
  defense: { label: '防御型', hp: 2, damage: 1, speed: 60, desc: '2 血 · 半速 · 标准伤害' },
};
export const BULLET_SPEED = 300;
export const BULLET_R = 4;
export const DEFAULT_FIRE_MS = 1000;
export const DEFAULT_BOUNCE = 4;

export const ITEM_SPAWN_MS = 15000;
export const ITEM_LIFE_MS = 30000;
export const BOT_SPAWN_MS = 15000;

export const PLAYERS = {
  2: { label: '1v1', scale: 2, bots: 1 },
  4: { label: '4 人混战', scale: 4, bots: 3 },
  8: { label: '8 人混战', scale: 6, bots: 7 },
};

export const MODES = {
  classic: { label: '经典', desc: '击杀所有人机即胜利' },
  rogue: { label: '肉鸽', desc: '人机每 30 秒刷新一次，无尽生存' },
};

export const WEAPONS = {
  laser: { name: '激光', kind: 'hitscan', uses: 3, bounce: 4, color: '#ff5ec4' },
  pierce: { name: '穿透激光', kind: 'pierce', uses: 1, chargeMs: 1000, color: '#7ef9ff' },
  shotgun: { name: '霰弹', kind: 'bullet', uses: 5, pellets: 3, bounce: 6, color: '#ffd166' },
  rapid: { name: '快速射击', kind: 'bullet', uses: Infinity, duration: 10000, fireMs: 300, bounce: 4, color: '#9dff6e' },
  shield: { name: '无敌', kind: 'buff', duration: 10000, color: '#7aa2ff' },
  thorns: { name: '反甲', kind: 'buff', duration: 10000, color: '#ff8a5c' },
};

export const ITEM_TYPES = Object.keys(WEAPONS);

export const BOT_COLORS = ['#ff6b6b', '#ffb454', '#c77dff', '#4cc9f0', '#f72585', '#f9c74f', '#90be6d'];
export const PLAYER_COLOR = '#7bd88f';
