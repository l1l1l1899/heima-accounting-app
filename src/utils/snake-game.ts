/**
 * 贪吃蛇游戏纯逻辑函数（从 SnakeGame.tsx 提取，不依赖 React/Canvas/DOM）
 */

export interface Point {
  x: number
  y: number
}

// ====== 游戏配置常量 ======
export const GRID_SIZE = 20
export const MAX_CELLS = GRID_SIZE * GRID_SIZE // 400
export const INITIAL_SPEED = 150
export const MIN_SPEED = 50
export const SPEED_STEP = 3

// ====== 方向定义 ======
export const DIRECTION_VECTORS: Record<string, Point> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
}

// ====== 纯计算函数 ======

/**
 * 判断方向是否与当前方向 180 度相反（不允许掉头）
 */
export function isOppositeDirection(current: Point, next: Point): boolean {
  return next.x === -current.x && next.y === -current.y
}

/**
 * 根据按键获取方向向量
 * 返回 undefined 表示不是方向键
 */
export function getDirection(key: string): Point | undefined {
  // 先直接匹配，再尝试小写匹配
  return DIRECTION_VECTORS[key] ?? (key.length === 1 ? DIRECTION_VECTORS[key.toLowerCase()] : undefined)
}

/**
 * 计算蛇头新位置
 */
export function moveSnakeHead(head: Point, direction: Point): Point {
  return {
    x: head.x + direction.x,
    y: head.y + direction.y,
  }
}

/**
 * 撞墙检测
 */
export function isWallCollision(pos: Point, gridSize: number = GRID_SIZE): boolean {
  return pos.x < 0 || pos.x >= gridSize || pos.y < 0 || pos.y >= gridSize
}

/**
 * 撞自己检测（排除蛇头自身）
 */
export function isSelfCollision(newHead: Point, snakeBody: Point[]): boolean {
  return snakeBody.some((p) => p.x === newHead.x && p.y === newHead.y)
}

/**
 * 吃食物判定
 */
export function isEating(head: Point, food: Point): boolean {
  return head.x === food.x && head.y === food.y
}

/**
 * 通关检测：蛇是否填满所有格子
 */
export function isWin(snakeLength: number, maxCells: number = MAX_CELLS): boolean {
  return snakeLength >= maxCells
}

/**
 * 蛇增长：加头不去尾
 */
export function growSnake(snake: Point[], newHead: Point): Point[] {
  return [newHead, ...snake]
}

/**
 * 蛇移动：加头去尾
 */
export function moveSnake(snake: Point[], newHead: Point): Point[] {
  const newSnake = [newHead, ...snake]
  newSnake.pop()
  return newSnake
}

/**
 * 吃食物后速度提升
 */
export function calcNewSpeed(currentSpeed: number, step: number = SPEED_STEP): number {
  return Math.max(MIN_SPEED, currentSpeed - step)
}

/**
 * 生成食物候选位置（所有未被蛇占用的格子）
 */
export function getFoodCandidates(snake: Point[], gridSize: number = GRID_SIZE): Point[] {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`))
  const candidates: Point[] = []
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      if (!occupied.has(`${x},${y}`)) {
        candidates.push({ x, y })
      }
    }
  }
  return candidates
}

/**
 * 是否为有效方向键
 */
export function isDirectionKey(key: string): boolean {
  return key in DIRECTION_VECTORS
}

/**
 * 是否为空格键
 */
export function isSpaceKey(key: string): boolean {
  return key === ' '
}

/**
 * 计算最高分更新
 */
export function updateHighScore(currentScore: number, highScore: number): {
  newHighScore: number
  isNewRecord: boolean
} {
  if (currentScore > highScore) {
    return { newHighScore: currentScore, isNewRecord: true }
  }
  return { newHighScore: highScore, isNewRecord: false }
}
