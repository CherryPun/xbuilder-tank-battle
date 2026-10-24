import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = 'D:/xbuilder-tank-battle/spx';

const LEVELS = [
  { cols: 20, rows: 15, tile: 24 },
  { cols: 30, rows: 22, tile: 16 },
  { cols: 40, rows: 30, tile: 12 },
];

const write = (rel, content) => {
  const p = join(ROOT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content, 'utf8');
};

const id = () => Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 13);

const mainSpx = `var (
	gameState int
	mode      int
	players   int
	playerType int

	hp     float64
	maxHP  float64
	damage float64

	level int
	tile  float64
	cols  int
	rows  int

	tick       int
	lastShot   int
	rapidUntil int
	shieldUntil int
	thornsUntil int
	ammoType   int
	ammoLeft   int

	playerX   float64
	playerY   float64
	playerDir int

	score     int
	kills     int
	botsAlive int
	botCap    int
	botsSpawned bool
	blipsSpawned bool
	itemsSpawned bool
	spawnID     int
	botRefillAt int
	itemAt      int

	botX [8]float64
	botY [8]float64
	botHP [8]float64
	botAlive [8]bool
	botDir [8]int
	botMoveTicks [8]int
	botFireAt [8]int

	shotX float64
	shotY float64
	shotVx float64
	shotVy float64
	shotBounces int
	shotGhost bool
	shotDamage float64
	shotOwner int

	randX float64
	randY float64

	itemX [4]float64
	itemY [4]float64
	itemType [4]int
	itemAlive [4]bool
	itemTime [4]int

	godMode bool
	konamiIdx int

	statusText  string
	modeText    string
	playersText string
	typeText    string
	ammoText    string
)

func Absf(v float64) float64 {
	if v < 0 {
		return -v
	}
	return v
}

func CellCol(x float64) int {
	return int((x + 240) / tile)
}

func CellRow(y float64) int {
	return int((180 - y) / tile)
}

func WallNoise(c, r int) int {
	n := ((c*7+r*13)*31 + c*3 + r*5) % 100
	if n < 0 {
		n = -n
	}
	return n
}

func IsWallCell(c, r int) bool {
	if c <= 0 || r <= 0 || c >= cols-1 || r >= rows-1 {
		return true
	}
	if c%4 == 1 || c%4 == 2 {
		if r%4 == 1 || r%4 == 2 {
			if WallNoise(c, r) < 62 {
				return true
			}
		}
	}
	return false
}

func BlockedAt(x, y float64) bool {
	h := tile * 0.32
	if IsWallCell(CellCol(x-h), CellRow(y-h)) {
		return true
	}
	if IsWallCell(CellCol(x+h), CellRow(y-h)) {
		return true
	}
	if IsWallCell(CellCol(x-h), CellRow(y+h)) {
		return true
	}
	if IsWallCell(CellCol(x+h), CellRow(y+h)) {
		return true
	}
	return false
}

func LineClear(x1, y1, x2, y2 float64) bool {
	n := int((Absf(x2-x1) + Absf(y2-y1)) / (tile * 0.4))
	if n < 2 {
		return true
	}
	for i := 1; i < n; i++ {
		px := x1 + (x2-x1)*float64(i)/float64(n)
		py := y1 + (y2-y1)*float64(i)/float64(n)
		if IsWallCell(CellCol(px), CellRow(py)) {
			return false
		}
	}
	return true
}

func UpdateTexts() {
	if mode == 0 {
		modeText = "经典"
	} else {
		modeText = "肉鸽"
	}
	if players == 2 {
		playersText = "1v1"
	}
	if players == 4 {
		playersText = "4人"
	}
	if players == 8 {
		playersText = "8人"
	}
	if playerType == 0 {
		typeText = "平衡型"
	}
	if playerType == 1 {
		typeText = "速度型"
	}
	if playerType == 2 {
		typeText = "防御型"
	}
}

func MenuText() {
	statusText = "空格开始 | 1/2/3 选坦克 | C 切模式 | X 切人数"
}

func UpdateAmmo() {
	ammoText = "默认弹"
	if ammoType == 1 {
		ammoText = "激光"
	}
	if ammoType == 2 {
		ammoText = "霰弹"
	}
	if ammoType == 3 {
		ammoText = "快速射击"
	}
	if ammoType == 4 {
		ammoText = "穿透激光"
	}
	if shieldUntil > tick {
		ammoText = ammoText + " +无敌"
	}
	if thornsUntil > tick {
		ammoText = ammoText + " +反甲"
	}
}

func ApplyItem(t int) {
	ammoType = 0
	ammoLeft = 0
	if t == 0 {
		ammoType = 1
		ammoLeft = 3
	}
	if t == 1 {
		ammoType = 4
		ammoLeft = 1
	}
	if t == 2 {
		ammoType = 2
		ammoLeft = 5
	}
	if t == 3 {
		ammoType = 3
		ammoLeft = 999
		rapidUntil = tick + 333
	}
	if t == 4 {
		shieldUntil = tick + 333
	}
	if t == 5 {
		thornsUntil = tick + 333
	}
	UpdateAmmo
}

func SpawnItem() {
	for i := 0; i < 4; i++ {
		if !itemAlive[i] {
			if PickSpot(tile * 2) {
				itemX[i] = randX
				itemY[i] = randY
				itemType[i] = int(rand(0, 5))
				itemAlive[i] = true
				itemTime[i] = tick
			}
			return
		}
	}
}

func KonamiStep(k int) {
	seq := [12]int{0, 0, 2, 2, 3, 1, 3, 1, 4, 5, 4, 5}
	if konamiIdx >= 12 {
		konamiIdx = 0
	}
	if seq[konamiIdx] == k {
		konamiIdx++
		if konamiIdx == 12 {
			konamiIdx = 0
			if godMode {
				godMode = false
				statusText = "彩蛋：无敌模式关闭"
			} else {
				godMode = true
				statusText = "彩蛋：无敌模式开启"
			}
		}
	} else {
		if k == 0 {
			konamiIdx = 1
		} else {
			konamiIdx = 0
		}
	}
}

func PickSpot(minDist float64) bool {
	for i := 0; i < 300; i++ {
		c := int(rand(1, cols-2))
		r := int(rand(1, rows-2))
		if !IsWallCell(c, r) {
			x := -240 + (float64(c)+0.5)*tile
			y := 180 - (float64(r)+0.5)*tile
			if Absf(x-playerX)+Absf(y-playerY) > minDist {
				randX = x
				randY = y
				return true
			}
		}
	}
	return false
}

func StartGame() {
	if players == 2 {
		level = 0
	}
	if players == 4 {
		level = 1
	}
	if players == 8 {
		level = 2
	}
	tile = 24
	if level == 1 {
		tile = 16
	}
	if level == 2 {
		tile = 12
	}
	cols = 20
	rows = 15
	if level == 1 {
		cols = 30
		rows = 22
	}
	if level == 2 {
		cols = 40
		rows = 30
	}

	if playerType == 0 {
		maxHP = 1
		damage = 1
	}
	if playerType == 1 {
		maxHP = 2
		damage = 0.5
	}
	if playerType == 2 {
		maxHP = 2
		damage = 1
	}
	hp = maxHP
	playerX = -240 + 3.5*tile
	playerY = 180 - 3.5*tile
	playerDir = 1

	score = 0
	kills = 0
	tick = 0
	lastShot = -300
	rapidUntil = 0
	shieldUntil = 0
	thornsUntil = 0
	ammoType = 0
	ammoLeft = 0
	botCap = players - 1
	botsAlive = 0
	botRefillAt = 500
	itemAt = 500

	for i := 0; i < 4; i++ {
		itemAlive[i] = false
	}
	UpdateAmmo

	for i := 0; i < 8; i++ {
		botAlive[i] = false
		botHP[i] = 1
	}
	for i := 0; i < botCap; i++ {
		if PickSpot(tile * 6) {
			botX[i] = randX
			botY[i] = randY
		} else {
			botX[i] = 240 - 3.5*tile
			botY[i] = -180 + 3.5*tile
		}
		botHP[i] = 1
		botAlive[i] = true
		botDir[i] = 2
		botMoveTicks[i] = 10
		botFireAt[i] = 30
		botsAlive++
	}

	if !botsSpawned {
		for i := 0; i < 8; i++ {
			spawnID = i
			Bot.clone
		}
		botsSpawned = true
	}

	statusText = ""
	UpdateTexts
	gameState = 1
}

func KillBot(id int) {
	if !botAlive[id] {
		return
	}
	botAlive[id] = false
	botsAlive--
	score += 10
	kills++
	if mode == 0 && botsAlive <= 0 {
		gameState = 2
		statusText = "全歼人机！按空格返回菜单"
	}
}

func DamagePlayer(d float64) {
	if gameState != 1 {
		return
	}
	if godMode {
		return
	}
	if shieldUntil > tick {
		return
	}
	if thornsUntil > tick {
		for i := 0; i < 8; i++ {
			if botAlive[i] {
				botHP[i] = botHP[i] - d
				if botHP[i] <= 0 {
					KillBot(i)
				}
				break
			}
		}
		return
	}
	hp = hp - d
	if hp <= 0 {
		gameState = 2
		statusText = "坦克阵亡！按空格返回菜单"
	}
}

func FireShot(owner int) {
	if gameState != 1 {
		return
	}
	if owner == 1 {
		gap := 33
		if ammoType == 3 {
			gap = 10
		}
		if tick-lastShot < gap {
			return
		}
		lastShot = tick
		shotX = playerX
		shotY = playerY
		shotDamage = damage
		shotBounces = 4
		shotGhost = false
		if ammoType == 1 {
			shotBounces = 4
			shotDamage = damage * 2
		}
		if ammoType == 2 {
			shotBounces = 6
		}
		if ammoType == 4 {
			shotGhost = true
			shotDamage = damage * 2
		}
		if ammoLeft > 0 {
			ammoLeft--
			if ammoLeft <= 0 {
				ammoType = 0
			}
		}
	} else {
		shotX = botX[spawnID]
		shotY = botY[spawnID]
		shotDamage = 1
		shotBounces = 0
		shotGhost = false
	}
	shotOwner = owner
	shotVx = tile * 0.36
	shotVy = 0
	if owner == 1 {
		if playerDir == 0 {
			shotVx = 0
			shotVy = tile * 0.36
		}
		if playerDir == 1 {
			shotVx = tile * 0.36
			shotVy = 0
		}
		if playerDir == 2 {
			shotVx = 0
			shotVy = -tile * 0.36
		}
		if playerDir == 3 {
			shotVx = -tile * 0.36
			shotVy = 0
		}
		if playerDir == 4 {
			shotVx = tile * 0.25
			shotVy = tile * 0.25
		}
		if playerDir == 5 {
			shotVx = tile * 0.25
			shotVy = -tile * 0.25
		}
		if playerDir == 6 {
			shotVx = -tile * 0.25
			shotVy = -tile * 0.25
		}
		if playerDir == 7 {
			shotVx = -tile * 0.25
			shotVy = tile * 0.25
		}
	} else {
		d := botDir[spawnID]
		if d == 0 {
			shotVx = 0
			shotVy = tile * 0.3
		}
		if d == 1 {
			shotVx = tile * 0.3
			shotVy = 0
		}
		if d == 2 {
			shotVx = 0
			shotVy = -tile * 0.3
		}
		if d == 3 {
			shotVx = -tile * 0.3
			shotVy = 0
		}
	}
	if owner == 1 && ammoType == 2 {
		px := 0.0
		py := 0.0
		if playerDir == 0 {
			px = 1
		}
		if playerDir == 2 {
			px = -1
		}
		if playerDir == 1 {
			py = 1
		}
		if playerDir == 3 {
			py = -1
		}
		for k := -1; k <= 1; k++ {
			shotX = playerX + px*float64(k)*tile*0.28
			shotY = playerY + py*float64(k)*tile*0.28
			Bullet.clone
		}
		return
	}
	Bullet.clone
}

func RefillBots() {
	for i := 0; i < botCap; i++ {
		if !botAlive[i] {
			if PickSpot(tile * 6) {
				botX[i] = randX
				botY[i] = randY
			} else {
				botX[i] = 240 - 3.5*tile
				botY[i] = -180 + 3.5*tile
			}
			botHP[i] = 1
			botAlive[i] = true
			botDir[i] = 2
			botMoveTicks[i] = 10
			botFireAt[i] = tick + 60
			botsAlive++
		}
	}
}

func GameTick() {
	if gameState != 1 {
		return
	}
	tick++
	if rapidUntil > 0 && tick > rapidUntil {
		rapidUntil = 0
		if ammoType == 3 {
			ammoType = 0
		}
	}
	if mode == 1 && tick >= botRefillAt {
		botRefillAt = tick + 500
		RefillBots
	}
	if tick >= itemAt {
		itemAt = tick + 500
		SpawnItem
	}
	for i := 0; i < 4; i++ {
		if itemAlive[i] && tick-itemTime[i] > 1000 {
			itemAlive[i] = false
		}
	}
	if tick%10 == 0 {
		UpdateAmmo
	}
}

onStart => {
	MenuText
	UpdateTexts
	if !blipsSpawned {
		for i := 0; i < 12; i++ {
			spawnID = i
			Blip.clone
		}
		blipsSpawned = true
	}
	if !itemsSpawned {
		for i := 0; i < 4; i++ {
			spawnID = i
			Item.clone
		}
		itemsSpawned = true
	}
	for {
		wait 0.03
		GameTick
	}
}
`;

const tankSpx = `onStart => {
	hide
	for {
		wait 0.03
		if gameState != 1 {
			hide
			continue
		}
		show
		setSize tile * 0.85 / 28
		vx := 0.0
		vy := 0.0
		if keyPressed(KeyLeft) || keyPressed(KeyA) {
			vx = -1
		}
		if keyPressed(KeyRight) || keyPressed(KeyD) {
			vx = 1
		}
		if keyPressed(KeyUp) || keyPressed(KeyW) {
			vy = 1
		}
		if keyPressed(KeyDown) || keyPressed(KeyS) {
			vy = -1
		}
		sp := tile * 0.15
		if playerType == 1 {
			sp = tile * 0.3
		}
		if playerType == 2 {
			sp = tile * 0.075
		}
		if vx != 0 || vy != 0 {
			if vx == 0 && vy > 0 {
				playerDir = 0
				setHeading Up
			}
			if vx > 0 && vy > 0 {
				playerDir = 4
				setHeading 45
			}
			if vx > 0 && vy == 0 {
				playerDir = 1
				setHeading Right
			}
			if vx > 0 && vy < 0 {
				playerDir = 5
				setHeading 135
			}
			if vx == 0 && vy < 0 {
				playerDir = 2
				setHeading Down
			}
			if vx < 0 && vy < 0 {
				playerDir = 6
				setHeading -135
			}
			if vx < 0 && vy == 0 {
				playerDir = 3
				setHeading Left
			}
			if vx < 0 && vy > 0 {
				playerDir = 7
				setHeading -45
			}
			nx := playerX + vx*sp
			if !BlockedAt(nx, playerY) {
				playerX = nx
			}
			ny := playerY + vy*sp
			if !BlockedAt(playerX, ny) {
				playerY = ny
			}
			lim := tile * 0.55
			if playerX < -240+lim {
				playerX = -240 + lim
			}
			if playerX > 240-lim {
				playerX = 240 - lim
			}
			if playerY < -180+lim {
				playerY = -180 + lim
			}
			if playerY > 180-lim {
				playerY = 180 - lim
			}
		}
		setXYpos playerX, playerY
		for i := 0; i < 4; i++ {
			if itemAlive[i] {
				if Absf(playerX-itemX[i]) < tile*0.7 && Absf(playerY-itemY[i]) < tile*0.7 {
					ApplyItem(itemType[i])
					itemAlive[i] = false
				}
			}
		}
	}
}

onKey Key1, => {
	if gameState == 0 {
		playerType = 0
		UpdateTexts
	}
}

onKey Key2, => {
	if gameState == 0 {
		playerType = 1
		UpdateTexts
	}
}

onKey Key3, => {
	if gameState == 0 {
		playerType = 2
		UpdateTexts
	}
}

onKey KeyC, => {
	if gameState == 0 {
		if mode == 0 {
			mode = 1
		} else {
			mode = 0
		}
		UpdateTexts
	}
}

onKey KeyX, => {
	if gameState == 0 {
		if players == 2 {
			players = 4
		} else if players == 4 {
			players = 8
		} else {
			players = 2
		}
		UpdateTexts
	}
}

onKey KeySpace, => {
	if gameState == 0 {
		StartGame
	} else if gameState == 2 {
		gameState = 0
		MenuText
		UpdateTexts
	} else {
		FireShot 1
	}
}

onKey KeyJ, => {
	if gameState == 1 {
		FireShot 1
	}
}

onKey KeyUp, => {
	if gameState == 0 {
		KonamiStep 0
	}
}

onKey KeyDown, => {
	if gameState == 0 {
		KonamiStep 2
	}
}

onKey KeyLeft, => {
	if gameState == 0 {
		KonamiStep 3
	}
}

onKey KeyRight, => {
	if gameState == 0 {
		KonamiStep 1
	}
}

onKey KeyB, => {
	if gameState == 0 {
		KonamiStep 4
	}
}

onKey KeyA, => {
	if gameState == 0 {
		KonamiStep 5
	}
}
`;

const botSpx = `onCloned => {
	id := spawnID
	hide
	for {
		wait 0.03
		if gameState != 1 || !botAlive[id] {
			hide
			continue
		}
		show
		setSize tile * 0.85 / 28
		setXYpos botX[id], botY[id]
		dx := playerX - botX[id]
		dy := playerY - botY[id]
		if Absf(dx) < tile*0.8 && LineClear(botX[id], botY[id], playerX, playerY) {
			if dy > 0 {
				botDir[id] = 0
				setHeading Up
			} else {
				botDir[id] = 2
				setHeading Down
			}
			if tick >= botFireAt[id] {
				spawnID = id
				FireShot 2
				botFireAt[id] = tick + 40
			}
			continue
		}
		if Absf(dy) < tile*0.8 && LineClear(botX[id], botY[id], playerX, playerY) {
			if dx > 0 {
				botDir[id] = 1
				setHeading Right
			} else {
				botDir[id] = 3
				setHeading Left
			}
			if tick >= botFireAt[id] {
				spawnID = id
				FireShot 2
				botFireAt[id] = tick + 40
			}
			continue
		}
		botMoveTicks[id]--
		if botMoveTicks[id] <= 0 {
			botDir[id] = int(rand(0, 3))
			if Absf(dx) > Absf(dy) {
				if dx > 0 {
					botDir[id] = 1
				} else {
					botDir[id] = 3
				}
			} else {
				if dy > 0 {
					botDir[id] = 0
				} else {
					botDir[id] = 2
				}
			}
			botMoveTicks[id] = int(rand(8, 20))
		}
		sp := tile * 0.12
		nx := botX[id]
		ny := botY[id]
		if botDir[id] == 0 {
			ny = ny + sp
			setHeading Up
		}
		if botDir[id] == 1 {
			nx = nx + sp
			setHeading Right
		}
		if botDir[id] == 2 {
			ny = ny - sp
			setHeading Down
		}
		if botDir[id] == 3 {
			nx = nx - sp
			setHeading Left
		}
		if BlockedAt(nx, ny) {
			botDir[id] = int(rand(0, 3))
			botMoveTicks[id] = int(rand(6, 14))
		} else {
			botX[id] = nx
			botY[id] = ny
			lim := tile * 0.55
			if botX[id] < -240+lim {
				botX[id] = -240 + lim
			}
			if botX[id] > 240-lim {
				botX[id] = 240 - lim
			}
			if botY[id] < -180+lim {
				botY[id] = -180 + lim
			}
			if botY[id] > 180-lim {
				botY[id] = 180 - lim
			}
		}
		setXYpos botX[id], botY[id]
	}
}
`;

const bulletSpx = `onCloned => {
	vx := shotVx
	vy := shotVy
	left := shotBounces
	ghost := shotGhost
	dmg := shotDamage
	owner := shotOwner
	hitR := tile * 0.45
	setXYpos shotX, shotY
	setSize tile * 0.24 / 8
	show
	for i := 0; i < 400; i++ {
		if gameState != 1 {
			destroy
			return
		}
		nx := xpos + vx
		if ghost {
			setXpos nx
		} else if IsWallCell(CellCol(nx), CellRow(ypos)) {
			if left > 0 {
				left--
				vx = -vx
			} else {
				destroy
				return
			}
		} else {
			setXpos nx
		}
		ny := ypos + vy
		if ghost {
			setYpos ny
		} else if IsWallCell(CellCol(xpos), CellRow(ny)) {
			if left > 0 {
				left--
				vy = -vy
			} else {
				destroy
				return
			}
		} else {
			setYpos ny
		}
		if ghost {
			if xpos < -260 || xpos > 260 || ypos < -200 || ypos > 200 {
				destroy
				return
			}
		} else if IsWallCell(CellCol(xpos), CellRow(ypos)) {
			destroy
			return
		}
		if owner == 1 {
			for id := 0; id < 8; id++ {
				if botAlive[id] {
					if Absf(xpos-botX[id]) < hitR && Absf(ypos-botY[id]) < hitR {
						botHP[id] = botHP[id] - dmg
						if botHP[id] <= 0 {
							KillBot(id)
						}
						destroy
						return
					}
				}
			}
		} else {
			if Absf(xpos-playerX) < hitR && Absf(ypos-playerY) < hitR {
				DamagePlayer(dmg)
				destroy
				return
			}
		}
		wait 0.02
	}
	destroy
}
`;

const fieldSpx = `onStart => {
	show
	for {
		setCostume level
		wait 0.1
	}
}
`;

const radarSpx = `onStart => {
	show
}
`;

const blipSpx = `onCloned => {
	id := spawnID
	hide
	for {
		wait 0.05
		if gameState != 1 {
			hide
			continue
		}
		if id == 0 {
			setCostume 0
			show
			setXYpos 186 + playerX/240*38, -132 + playerY/180*26
			continue
		}
		if id < 8 {
			s := id - 1
			if botAlive[s] {
				setCostume 1
				show
				setXYpos 186 + botX[s]/240*38, -132 + botY[s]/180*26
			} else {
				hide
			}
			continue
		}
		k := id - 8
		if itemAlive[k] {
			setCostume 2
			show
			setXYpos 186 + itemX[k]/240*38, -132 + itemY[k]/180*26
		} else {
			hide
		}
	}
}
`;

const itemSpx = `onCloned => {
	id := spawnID
	hide
	for {
		wait 0.05
		if gameState != 1 || !itemAlive[id] {
			hide
			continue
		}
		show
		setCostume itemType[id]
		setSize tile * 0.55 / 22
		setXYpos itemX[id], itemY[id]
	}
}
`;

const itemSvg = (color, glyph) => `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
  <rect x="1" y="1" width="20" height="20" rx="2" fill="#0b0b12" stroke="${color}" stroke-width="2"/>
  ${glyph}
</svg>
`;
const radarSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="104" height="78" viewBox="0 0 104 78">
  <rect x="1" y="1" width="102" height="76" fill="#08080e" fill-opacity="0.72" stroke="#2b2b3f" stroke-width="2"/>
  <rect x="6" y="6" width="92" height="66" fill="none" stroke="#1f1f2e" stroke-width="1"/>
</svg>
`;

const blipSvg = (color) => `<svg xmlns="http://www.w3.org/2000/svg" width="6" height="6" viewBox="0 0 6 6">
  <rect width="6" height="6" rx="1" fill="${color}"/>
</svg>
`;

const fieldSvg = (lvl) => {
  const { cols, rows, tile } = LEVELS[lvl];
  const W = 480;
  const H = 360;
  const isWall = (c, r) => {
    if (c <= 0 || r <= 0 || c >= cols - 1 || r >= rows - 1) return true;
    const noise = (((c * 7 + r * 13) * 31 + c * 3 + r * 5) % 100 + 100) % 100;
    if (c % 4 === 1 || c % 4 === 2) {
      if (r % 4 === 1 || r % 4 === 2) return noise < 62;
    }
    return false;
  };
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
    `<rect width="${W}" height="${H}" fill="#0e0e16"/>`,
  ];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isWall(c, r)) continue;
      const x = c * tile;
      const y = r * tile;
      parts.push(`<rect x="${x}" y="${y}" width="${tile}" height="${tile}" fill="#2a1611"/>`);
      const rowsOfBrick = Math.max(1, Math.round(tile / 8));
      const bh = tile / rowsOfBrick;
      for (let row = 0; row < rowsOfBrick; row++) {
        const yy = y + row * bh + 0.5;
        parts.push(`<rect x="${x + 0.5}" y="${yy}" width="${tile - 1}" height="${Math.max(1, bh - 1.5)}" fill="#7c4630"/>`);
      }
    }
  }
  parts.push('</svg>');
  return parts.join('\n');
};

const tankSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <rect x="2" y="3" width="5" height="22" rx="1" fill="#1e3a26"/>
  <rect x="21" y="3" width="5" height="22" rx="1" fill="#1e3a26"/>
  <rect x="6" y="5" width="16" height="18" rx="2" fill="#7bd88f"/>
  <rect x="9" y="8" width="10" height="11" rx="1" fill="#a9e9b8"/>
  <rect x="12" y="1" width="4" height="13" fill="#14311c"/>
</svg>
`;

const botSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <rect x="2" y="3" width="5" height="22" rx="1" fill="#3a1515"/>
  <rect x="21" y="3" width="5" height="22" rx="1" fill="#3a1515"/>
  <rect x="6" y="5" width="16" height="18" rx="2" fill="#ff6b6b"/>
  <rect x="9" y="8" width="10" height="11" rx="1" fill="#ffb3b3"/>
  <rect x="12" y="1" width="4" height="13" fill="#3a1515"/>
</svg>
`;

const bulletSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 8 8">
  <rect width="8" height="8" rx="2" fill="#ffe08a"/>
</svg>
`;

const FIELD_ID = id();
const TANK_ID = id();
const BOT_ID = id();
const BULLET_ID = id();
const RADAR_ID = id();
const BLIP_ID = id();
const ITEM_ID = id();

const spriteJson = (opts) =>
  JSON.stringify(
    {
      heading: opts.heading,
      x: opts.x,
      y: opts.y,
      size: 1,
      rotationStyle: 'normal',
      physicsMode: 'no',
      costumeIndex: 0,
      visible: opts.visible,
      isDraggable: false,
      collisionPivot: { x: 0, y: 0 },
      collisionShapeType: 'none',
      collisionShapeParams: [],
      fAnimations: {},
      animBindings: {},
      builder_id: opts.builderId,
      costumes: opts.costumes.map((c) => ({
        x: c.w / 2,
        y: c.h / 2,
        faceRight: 0,
        bitmapResolution: 1,
        name: c.name,
        path: c.path,
        builder_id: id(),
        imageWidth: c.w,
        imageHeight: c.h,
      })),
    },
    null,
    2
  );

const monitor = (name, label, val, x, y) => ({
  type: 'monitor',
  name,
  x,
  y,
  size: 0.65,
  visible: true,
  builder_id: 'ztb-' + name,
  label,
  mode: 1,
  style: 'default',
  target: '',
  val,
});

const stageJson = JSON.stringify(
  {
    backdrops: [],
    backdropIndex: 0,
    map: { width: 480, height: 360, mode: 'fillRatio' },
    physics: false,
    layerSortMode: '',
    autoSetCollisionLayer: true,
    stretchMode: true,
    audioAttenuation: 1,
    audioMaxDistance: 768,
    run: { width: 480, height: 360 },
    camera: { on: '' },
    zorder: [
      'Field',
      'Tank',
      'Bot',
      'Item',
      'Bullet',
      'Radar',
      'Blip',
      monitor('m-score', '分数', 'score', -232, 172),
      monitor('m-bots', '人机', 'botsAlive', -150, 172),
      monitor('m-mode', '模式', 'modeText', -68, 172),
      monitor('m-players', '人数', 'playersText', 20, 172),
      monitor('m-type', '类型', 'typeText', 110, 172),
      monitor('m-ammo', '装备', 'ammoText', -232, 146),
      monitor('m-status', '状态', 'statusText', -232, -172),
    ],
    builder_spriteOrder: [FIELD_ID, TANK_ID, BOT_ID, ITEM_ID, BULLET_ID, RADAR_ID, BLIP_ID],
    builder_soundOrder: [],
    maxFPS: 60,
    fontPreferences: ['basic-chinese', 'default'],
  },
  null,
  2
);

const meta = JSON.stringify(
  { type: 'game', displayName: 'xbuilder-tank-battle', description: '', instructions: '' },
  null,
  2
);

write('main.spx', mainSpx);
write('Tank.spx', tankSpx);
write('Bot.spx', botSpx);
write('Bullet.spx', bulletSpx);
write('Field.spx', fieldSpx);
write('Radar.spx', radarSpx);
write('Blip.spx', blipSpx);
write('Item.spx', itemSpx);
write('builder-meta.json', meta);
write('assets/index.json', stageJson);
write('assets/sprites/Field/index.json', spriteJson({
  heading: 0,
  x: 0,
  y: 0,
  visible: true,
  builderId: FIELD_ID,
  costumes: [
    { name: 'map-1v1', path: 'map-1v1.svg', w: 480, h: 360 },
    { name: 'map-4p', path: 'map-4p.svg', w: 480, h: 360 },
    { name: 'map-8p', path: 'map-8p.svg', w: 480, h: 360 },
  ],
}));
write('assets/sprites/Field/map-1v1.svg', fieldSvg(0));
write('assets/sprites/Field/map-4p.svg', fieldSvg(1));
write('assets/sprites/Field/map-8p.svg', fieldSvg(2));
write('assets/sprites/Tank/index.json', spriteJson({ heading: 90, x: -204, y: -132, visible: false, builderId: TANK_ID, costumes: [{ name: 'tank', path: 'tank.svg', w: 28, h: 28 }] }));
write('assets/sprites/Tank/tank.svg', tankSvg);
write('assets/sprites/Bot/index.json', spriteJson({ heading: 90, x: 0, y: 0, visible: false, builderId: BOT_ID, costumes: [{ name: 'bot', path: 'bot.svg', w: 28, h: 28 }] }));
write('assets/sprites/Bot/bot.svg', botSvg);
write('assets/sprites/Bullet/index.json', spriteJson({ heading: 90, x: 0, y: 0, visible: false, builderId: BULLET_ID, costumes: [{ name: 'bullet', path: 'bullet.svg', w: 8, h: 8 }] }));
write('assets/sprites/Bullet/bullet.svg', bulletSvg);
write('assets/sprites/Radar/index.json', spriteJson({ heading: 0, x: 186, y: -132, visible: true, builderId: RADAR_ID, costumes: [{ name: 'radar', path: 'radar.svg', w: 104, h: 78 }] }));
write('assets/sprites/Radar/radar.svg', radarSvg);
write('assets/sprites/Blip/index.json', spriteJson({
  heading: 0,
  x: 186,
  y: -132,
  visible: false,
  builderId: BLIP_ID,
  costumes: [
    { name: 'player', path: 'green.svg', w: 6, h: 6 },
    { name: 'bot', path: 'red.svg', w: 6, h: 6 },
    { name: 'item', path: 'gold.svg', w: 6, h: 6 },
  ],
}));
write('assets/sprites/Blip/green.svg', blipSvg('#7bd88f'));
write('assets/sprites/Blip/red.svg', blipSvg('#ff6b6b'));
write('assets/sprites/Blip/gold.svg', blipSvg('#ffd166'));
write('assets/sprites/Item/index.json', spriteJson({
  heading: 0,
  x: 0,
  y: 0,
  visible: false,
  builderId: ITEM_ID,
  costumes: [
    { name: 'laser', path: 'laser.svg', w: 22, h: 22 },
    { name: 'pierce', path: 'pierce.svg', w: 22, h: 22 },
    { name: 'shotgun', path: 'shotgun.svg', w: 22, h: 22 },
    { name: 'rapid', path: 'rapid.svg', w: 22, h: 22 },
    { name: 'shield', path: 'shield.svg', w: 22, h: 22 },
    { name: 'thorns', path: 'thorns.svg', w: 22, h: 22 },
  ],
}));
write('assets/sprites/Item/laser.svg', itemSvg('#ff5ec4', '<rect x="4" y="10" width="14" height="2" fill="#ff5ec4"/>'));
write('assets/sprites/Item/pierce.svg', itemSvg('#7ef9ff', '<rect x="9" y="4" width="4" height="14" fill="#7ef9ff"/>'));
write('assets/sprites/Item/shotgun.svg', itemSvg('#ffd166', '<rect x="4" y="9" width="3" height="4" fill="#ffd166"/><rect x="9" y="9" width="3" height="4" fill="#ffd166"/><rect x="14" y="9" width="3" height="4" fill="#ffd166"/>'));
write('assets/sprites/Item/rapid.svg', itemSvg('#9dff6e', '<path d="M6 6 L11 11 L6 16" stroke="#9dff6e" stroke-width="2" fill="none"/><path d="M11 6 L16 11 L11 16" stroke="#9dff6e" stroke-width="2" fill="none"/>'));
write('assets/sprites/Item/shield.svg', itemSvg('#7aa2ff', '<circle cx="11" cy="11" r="6" fill="none" stroke="#7aa2ff" stroke-width="2"/>'));
write('assets/sprites/Item/thorns.svg', itemSvg('#ff8a5c', '<path d="M5 5 L17 17 M17 5 L5 17" stroke="#ff8a5c" stroke-width="2"/>'));

const fontsSrc = 'C:/Users/大禧子/AppData/Local/Temp/opencode/xbp/assets/fonts';
if (existsSync(fontsSrc)) {
  for (const rel of ['basic-chinese/font.ttf', 'basic-chinese/index.json']) {
    const from = join(fontsSrc, rel);
    if (existsSync(from)) {
      const to = join(ROOT, 'assets/fonts', rel);
      mkdirSync(dirname(to), { recursive: true });
      copyFileSync(from, to);
    }
  }
}

const thumb = 'C:/Users/大禧子/AppData/Local/Temp/opencode/xbp/builder-thumbnail.jpeg';
if (existsSync(thumb)) copyFileSync(thumb, join(ROOT, 'builder-thumbnail.jpeg'));

console.log('generated spx project at', ROOT);
