# 架构设计文档

## 1. 项目概览

《像素坦克大战》提供两份可运行实现：

| 实现 | 位置 | 用途 |
| --- | --- | --- |
| 网页版（原生 JS + Canvas） | 仓库根目录 | 本地/云端浏览器演示，规则最完整，便于快速迭代 |
| XBuilder / SPX 版 | `xbuilder/spx/`（由 `xbuilder/tools/gen-spx.mjs` 生成），成品 `xbuilder/xbuilder-tank-battle.xbp` | 赛题要求的 XBuilder 内可运行版本 |

两份实现共享同一套玩法数值（坦克类型、装备、刷新节奏、地图尺寸），但受平台能力限制存在少量差异，见第 6 节。

## 2. 网页版模块

模块之间单向依赖：`main → 其余模块`，`render/ai` 只读取状态，不写状态。

| 文件 | 职责 | 主要导出 / 接口 |
| --- | --- | --- |
| `src/config.js` | 常量与数值表：瓦片尺寸、视野、人数与地图倍率、坦克类型、装备定义 | `TILE`、`VIEW_W/H`、`PLAYERS`、`TANK_TYPES`、`WEAPONS`、`DIRS`、`dirFromAxes()` |
| `src/map.js` | 迷宫生成、网格查询、碰撞查询、出生点、随机空位 | `createMap()`、`isWall()`、`rectHitsWall()`、`spawnTiles()`、`reachableSet()`、`randomEmptyTile()`、`wallAt()`、`reflectAxes()` |
| `src/entities.js` | 实体数据与移动：坦克、子弹、装备 | `Tank`（`hp/damage/baseSpeed`、`step()`、`canBeAt()`）、`Bullet`（`vx/vy/bounce/damage`）、`Item` |
| `src/weapons.js` | 开火判定、命中结算、激光反弹、穿透光束、装备生效 | `tickFire()`、`applyItem()`、`expireWeapons()` |
| `src/ai.js` | 人机行为：寻路、瞄准、开火 | `updateBot()` |
| `src/render.js` | Canvas 绘制与小地图 | `drawScene()`、`drawMinimap()` |
| `src/main.js` | 游戏状态机、输入、主循环、HUD、菜单与彩蛋 | `Game` 类（`start/update/end`）、输入映射、`updateHud()` |
| `tests/smoke.mjs` | 逻辑冒烟测试 | 地图连通性、激光反弹次数、穿透破墙、类型数值、高速移动防穿墙 |

数据流：`keydown → input 状态 → Game.update()（移动/开火/AI/子弹/装备）→ 状态数组 → drawScene()/drawMinimap()/HUD`。

## 3. XBuilder（SPX）版结构

SPX 以「精灵 + 脚本 + 素材」为组织方式，全局状态集中在 `main.spx`，各精灵脚本只读写全局状态与自身属性。

| 文件 | 职责 | 关键内容 |
| --- | --- | --- |
| `main.spx` | 全局状态与规则 | 状态机 `gameState`（0 菜单 / 1 对局 / 2 结算）、模式/人数/类型、`hp/damage`、子弹参数、人机数组 `botX/Y/HP/Alive/Dir`、装备数组 `itemX/Y/Type/Alive`、`IsWallCell/BlockedAt/LineClear`、`StartGame/FireShot/KillBot/DamagePlayer/ApplyItem/SpawnItem/KonamiStep` |
| `Tank.spx` | 玩家 | 八方向移动与朝向、射击（`KeyJ`/`KeySpace`）、装备拾取、菜单按键（1/2/3 类型、C 模式、X 人数）、彩蛋序列（↑↑↓↓←→←→ B A B A） |
| `Bot.spx` | 人机（8 个预克隆槽位） | 槽位索引 `spawnID`、追击/随机游走、对齐且有视线时开火 |
| `Bullet.spx` | 子弹（玩家/人机共用） | 逐帧位移、撞墙按轴反弹（`shotBounces` 次）、命中判定与伤害结算 |
| 舞台背景 `assets/arena.svg` | 迷宫背景 | backdrop 直接铺满 480×360 舞台，避免精灵缩放导致错位 |
| `Radar.spx` + `Blip.spx` | 小地图 | 面板 + 12 个光点（玩家/人机/装备）按世界坐标等比映射 |
| `xbuilder/tools/gen-spx.mjs` | 工程生成器 | 生成地图 SVG（与碰撞公式同源）、精灵 `index.json`、`.spx` 脚本 |
| `xbuilder/tools/pack-xbp.ps1` | 打包 | 将 `spx/` 以正斜杠路径压成 `.xbp` |

XBuilder 版本的项目文件由生成器统一产出，避免「贴图与碰撞各写一套」导致的不一致：`IsWallCell` 与 SVG 使用同一个网格与哈希公式。

## 4. 规则实现对照

| 规则 | 网页版 | XBuilder 版 |
| --- | --- | --- |
| 坦克类型 | 平衡 1血/1伤/120速；速度 1血/0.5伤/240速；防御 2血/1伤/60速 | 同左，速度按瓦片尺寸换算 |
| 装备 | 6 种、15 秒刷新、拾取生效 | 已移除（稳定性优先） |
| 子弹反弹 | 默认 4 次，霰弹 6 次 | 默认 4 次 |
| 人机 | 数量=人数-1；肉鸽 15 秒补满 | 同左（500 tick 补满至上限） |
| 彩蛋 | 菜单页 Konami 序列切换无敌 | 菜单页同一序列，`godMode` 免伤 |
| 地图 | 基准 ×2/×4/×6，镜头跟随 | 固定 4 人尺寸 40×30 格（480×360），单屏 |

## 5. 分工

单人作品，全部模块由 **吴承禧** 完成：

| 模块 | 负责人 |
| --- | --- |
| 玩法与数值设计、网页版全部代码、测试 | 吴承禧 |
| XBuilder/SPX 版脚本与素材、`.xbp` 打包 | 吴承禧 |
| 运行说明、架构文档、演示素材 | 吴承禧 |

## 6. 平台适配与已知差异

1. **无镜头跟随**：XBuilder 的世界尺寸在项目配置中静态声明，`camera.on` 只能指定跟随目标；若为大图启用跟随，1v1 会因世界过大而露出空旷区域，且 HUD 精灵（小地图）会随镜头滚动。当前以「缩小地图倍数 + 加大瓦片 + 小地图光点」替代。
2. **地图尺寸**：网页版为 ×2/×4/×6；XBuilder 版按需求固定为 4 人尺寸 40×30 格（瓦片 12px，世界 480×360），背景使用舞台 backdrop 而非精灵，确保贴图与碰撞严格对齐。
3. **激光**：网页版为瞬时射线（4 次反弹、第 5 次撞墙停止）；XBuilder 版用高速弹丸近似，反弹次数一致。
4. **墙体**：XBuilder 版墙体不可破坏。
5. **装备**：为避免 XGo 克隆/对象生命周期带来的不稳定，XBuilder 版暂不提供装备系统（网页版保留完整 6 种装备）。
6. **菜单**：受 SPX 交互限制，用键盘选择（1/2/3、C、X、空格）而非鼠标按钮。
