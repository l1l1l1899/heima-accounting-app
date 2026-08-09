/**
 * 贪吃蛇游戏纯逻辑的单元测试
 */
import { describe, it, expect } from 'vitest'
import {
  isOppositeDirection,
  getDirection,
  moveSnakeHead,
  isWallCollision,
  isSelfCollision,
  isEating,
  isWin,
  growSnake,
  moveSnake,
  calcNewSpeed,
  getFoodCandidates,
  isDirectionKey,
  isSpaceKey,
  updateHighScore,
  GRID_SIZE,
  MAX_CELLS,
} from './snake-game'
import type { Point } from './snake-game'

// ============================================================
// isOppositeDirection 测试
// ============================================================
describe('isOppositeDirection — 方向反向检测', () => {
  it('左右相反', () => {
    expect(isOppositeDirection({ x: 1, y: 0 }, { x: -1, y: 0 })).toBe(true)
  })

  it('右左相反', () => {
    expect(isOppositeDirection({ x: -1, y: 0 }, { x: 1, y: 0 })).toBe(true)
  })

  it('上下相反', () => {
    expect(isOppositeDirection({ x: 0, y: -1 }, { x: 0, y: 1 })).toBe(true)
  })

  it('相同方向不是反向', () => {
    expect(isOppositeDirection({ x: 1, y: 0 }, { x: 1, y: 0 })).toBe(false)
  })

  it('垂直方向不是反向（右→上）', () => {
    expect(isOppositeDirection({ x: 1, y: 0 }, { x: 0, y: -1 })).toBe(false)
  })
})

// ============================================================
// getDirection 测试
// ============================================================
describe('getDirection — 按键转方向', () => {
  it('ArrowUp → 上', () => {
    expect(getDirection('ArrowUp')).toEqual({ x: 0, y: -1 })
  })

  it('小写 w → 上', () => {
    expect(getDirection('w')).toEqual({ x: 0, y: -1 })
  })

  it('大写 W → 上', () => {
    expect(getDirection('W')).toEqual({ x: 0, y: -1 })
  })

  it('ArrowDown → 下', () => {
    expect(getDirection('ArrowDown')).toEqual({ x: 0, y: 1 })
  })

  it('非方向键返回 undefined', () => {
    expect(getDirection('Enter')).toBeUndefined()
    expect(getDirection('Shift')).toBeUndefined()
    expect(getDirection('x')).toBeUndefined()
  })
})

// ============================================================
// moveSnakeHead 测试
// ============================================================
describe('moveSnakeHead — 蛇头移动', () => {
  it('向右移动一格', () => {
    expect(moveSnakeHead({ x: 10, y: 10 }, { x: 1, y: 0 })).toEqual({ x: 11, y: 10 })
  })

  it('向上移动一格', () => {
    expect(moveSnakeHead({ x: 5, y: 5 }, { x: 0, y: -1 })).toEqual({ x: 5, y: 4 })
  })
})

// ============================================================
// isWallCollision 测试
// ============================================================
describe('isWallCollision — 撞墙检测', () => {
  it('在网格内：不撞墙', () => {
    expect(isWallCollision({ x: 10, y: 10 })).toBe(false)
  })

  it('左上角 (0,0)：不撞墙', () => {
    expect(isWallCollision({ x: 0, y: 0 })).toBe(false)
  })

  it('右下角 (19,19)：不撞墙', () => {
    expect(isWallCollision({ x: 19, y: 19 })).toBe(false)
  })

  it('超出左边界', () => {
    expect(isWallCollision({ x: -1, y: 10 })).toBe(true)
  })

  it('超出上边界', () => {
    expect(isWallCollision({ x: 10, y: -1 })).toBe(true)
  })

  it('超出右边界', () => {
    expect(isWallCollision({ x: 20, y: 10 })).toBe(true)
  })

  it('超出下边界', () => {
    expect(isWallCollision({ x: 10, y: 20 })).toBe(true)
  })
})

// ============================================================
// isSelfCollision 测试
// ============================================================
describe('isSelfCollision — 撞自己检测', () => {
  const snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ]

  it('蛇头移动到蛇身位置 → 撞自己', () => {
    expect(isSelfCollision({ x: 9, y: 10 }, snake.slice(1))).toBe(true)
  })

  it('蛇头位置不在蛇身上 → 不撞', () => {
    expect(isSelfCollision({ x: 12, y: 10 }, snake.slice(1))).toBe(false)
  })

  it('空蛇身：不会撞', () => {
    expect(isSelfCollision({ x: 0, y: 0 }, [])).toBe(false)
  })
})

// ============================================================
// isEating 测试
// ============================================================
describe('isEating — 吃食物判定', () => {
  it('蛇头和食物位置相同 → 吃到', () => {
    expect(isEating({ x: 5, y: 3 }, { x: 5, y: 3 })).toBe(true)
  })

  it('位置不同 → 没吃到', () => {
    expect(isEating({ x: 5, y: 3 }, { x: 6, y: 3 })).toBe(false)
  })
})

// ============================================================
// isWin 测试
// ============================================================
describe('isWin — 通关检测', () => {
  it('蛇长等于 MAX_CELLS → 通关', () => {
    expect(isWin(400)).toBe(true)
  })

  it('蛇长超过 MAX_CELLS → 通关', () => {
    expect(isWin(401)).toBe(true)
  })

  it('蛇长不足 → 未通关', () => {
    expect(isWin(3)).toBe(false)
    expect(isWin(399)).toBe(false)
  })
})

// ============================================================
// growSnake 测试
// ============================================================
describe('growSnake — 蛇增长（吃食物）', () => {
  it('加头不去尾 → 长度 +1', () => {
    const snake: Point[] = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
    ]
    const grown = growSnake(snake, { x: 6, y: 5 })
    expect(grown).toHaveLength(3)
    expect(grown[0]).toEqual({ x: 6, y: 5 })
    expect(grown[2]).toEqual({ x: 4, y: 5 })
  })
})

// ============================================================
// moveSnake 测试
// ============================================================
describe('moveSnake — 蛇移动（没吃到食物）', () => {
  it('加头去尾 → 长度不变', () => {
    const snake: Point[] = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ]
    const moved = moveSnake(snake, { x: 6, y: 5 })
    expect(moved).toHaveLength(3)
    expect(moved[0]).toEqual({ x: 6, y: 5 }) // 新头
    expect(moved[2]).toEqual({ x: 4, y: 5 }) // 尾巴去掉了
  })

  it('不修改原数组', () => {
    const snake: Point[] = [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
    ]
    const moved = moveSnake(snake, { x: 6, y: 5 })
    expect(moved).not.toBe(snake)
    expect(snake).toHaveLength(2)
  })
})

// ============================================================
// calcNewSpeed 测试
// ============================================================
describe('calcNewSpeed — 速度提升', () => {
  it('正常提速：150 → 147', () => {
    expect(calcNewSpeed(150)).toBe(147)
  })

  it('连续吃食物：150 → 147 → 144 → 141', () => {
    const s1 = calcNewSpeed(150)
    const s2 = calcNewSpeed(s1)
    const s3 = calcNewSpeed(s2)
    expect(s1).toBe(147)
    expect(s2).toBe(144)
    expect(s3).toBe(141)
  })

  it('达到最低速度后不再减少', () => {
    expect(calcNewSpeed(52)).toBe(50)
    expect(calcNewSpeed(50)).toBe(50)
  })
})

// ============================================================
// getFoodCandidates 测试
// ============================================================
describe('getFoodCandidates — 食物候选位置', () => {
  it('空蛇身：所有格子都是候选', () => {
    const candidates = getFoodCandidates([], 3)
    expect(candidates).toHaveLength(9) // 3x3
  })

  it('蛇占了格子后被排除', () => {
    const snake: Point[] = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]
    const candidates = getFoodCandidates(snake, 3)
    expect(candidates).toHaveLength(7) // 9 - 2
    // 确保蛇占的格子不在候选里
    expect(candidates.find(p => p.x === 0 && p.y === 0)).toBeUndefined()
  })

  it('蛇占满所有格子：候选为空', () => {
    const snake: Point[] = []
    for (let x = 0; x < 2; x++)
      for (let y = 0; y < 2; y++)
        snake.push({ x, y })
    const candidates = getFoodCandidates(snake, 2)
    expect(candidates).toHaveLength(0)
  })
})

// ============================================================
// isDirectionKey / isSpaceKey 测试
// ============================================================
describe('isDirectionKey — 方向键判断', () => {
  it('WASD 是方向键', () => {
    expect(isDirectionKey('w')).toBe(true)
    expect(isDirectionKey('a')).toBe(true)
    expect(isDirectionKey('s')).toBe(true)
    expect(isDirectionKey('d')).toBe(true)
  })

  it('方向键是方向键', () => {
    expect(isDirectionKey('ArrowUp')).toBe(true)
  })

  it('空格不是方向键', () => {
    expect(isDirectionKey(' ')).toBe(false)
  })
})

describe('isSpaceKey — 空格判断', () => {
  it('空格返回 true', () => {
    expect(isSpaceKey(' ')).toBe(true)
  })

  it('非空格返回 false', () => {
    expect(isSpaceKey('Enter')).toBe(false)
  })
})

// ============================================================
// updateHighScore 测试
// ============================================================
describe('updateHighScore — 最高分更新', () => {
  it('超过历史最高：新纪录', () => {
    const result = updateHighScore(100, 50)
    expect(result.newHighScore).toBe(100)
    expect(result.isNewRecord).toBe(true)
  })

  it('平历史最高：不是新纪录', () => {
    const result = updateHighScore(50, 50)
    expect(result.newHighScore).toBe(50)
    expect(result.isNewRecord).toBe(false)
  })

  it('低于历史最高：保持原纪录', () => {
    const result = updateHighScore(30, 50)
    expect(result.newHighScore).toBe(50)
    expect(result.isNewRecord).toBe(false)
  })
})
