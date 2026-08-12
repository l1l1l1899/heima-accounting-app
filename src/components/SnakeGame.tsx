/**
 * 贪吃蛇小游戏 —— Canvas 实现的经典贪吃蛇
 *
 * 游戏规则：
 * - 🐍 用方向键或 WASD 控制蛇的移动
 * - 🍎 吃到食物蛇身变长，速度加快
 * - 💀 撞墙或撞到自己则游戏结束
 * - 🏆 吃满所有格子则通关
 * - ⏸️ 空格键暂停/继续
 *
 * 技术说明：
 * - 使用 Canvas 2D 绘制游戏画面（不是 DOM 元素）
 * - 游戏循环用 setTimeout 实现（不用 requestAnimationFrame，因为要控制速度）
 * - 游戏状态用 useRef 存储（避免每帧触发重渲染）
 * - UI 状态用 useState（得分、最高分、游戏状态）
 */
import { useRef, useEffect, useState, useCallback } from 'react'
import { Button, Card, Space, Typography, Tag, Statistic } from 'antd'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  TrophyOutlined
} from '@ant-design/icons'
import {
  GRID_SIZE,
  MAX_CELLS,
  INITIAL_SPEED,
  MIN_SPEED,
  SPEED_STEP,
  DIRECTION_VECTORS,
  getDirection,
  isOppositeDirection,
  isWallCollision,
  isSelfCollision,
  isEating,
  isWin,
  calcNewSpeed,
  getFoodCandidates,
  isDirectionKey,
  isSpaceKey,
  updateHighScore,
  moveSnakeHead,
  type Point,
} from '../utils/snake-game'

const { Text } = Typography

// Canvas 专用常量（与游戏逻辑无关，只影响画面大小）
const CELL_SIZE = 22
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE  // 440px

/** 游戏状态 */
type GameStatus = 'idle' | 'running' | 'paused' | 'over' | 'win'

// ====== 游戏 Hook ======
function useSnakeGame(canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  // UI 相关状态
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(() => {
    try { return parseInt(localStorage.getItem('snake-high-score') || '0', 10) }
    catch { return 0 }
  })
  const [status, setStatus] = useState<GameStatus>('idle')

  // 游戏内部状态（用 ref 避免重渲染开销）
  const snakeRef = useRef<Point[]>([])
  const foodRef = useRef<Point>({ x: 15, y: 10 })
  const directionRef = useRef<Point>({ x: 1, y: 0 })
  const nextDirectionRef = useRef<Point>({ x: 1, y: 0 })
  const speedRef = useRef(INITIAL_SPEED)
  const timerRef = useRef<number | null>(null)
  const statusRef = useRef<GameStatus>('idle')
  const scoreRef = useRef(0)
  const highScoreRef = useRef(highScore)

  // 同步 status 到 ref
  const updateStatus = useCallback((s: GameStatus) => {
    statusRef.current = s
    setStatus(s)
  }, [])

  // 同步 score（委托给纯函数 updateHighScore 计算是否破纪录）
  const updateScore = useCallback((s: number) => {
    scoreRef.current = s
    setScore(s)
    const { newHighScore, isNewRecord } = updateHighScore(s, highScoreRef.current)
    if (isNewRecord) {
      highScoreRef.current = newHighScore
      setHighScore(newHighScore)
      try { localStorage.setItem('snake-high-score', String(newHighScore)) } catch { /* 忽略存储异常 */ }
    }
  }, [])

  // ====== 生成食物（委托给纯函数 getFoodCandidates） ======
  const spawnFood = useCallback((): Point | null => {
    const candidates = getFoodCandidates(snakeRef.current, GRID_SIZE)
    if (candidates.length === 0) return null
    return candidates[Math.floor(Math.random() * candidates.length)]
  }, [])

  // ====== Canvas 绘制 ======
  /**
   * 每帧重绘整个游戏画面：
   * 1. 深色背景 + 隐约的网格线
   * 2. 红色的食物（带脉冲动画效果，像在呼吸）
   * 3. 绿色的蛇头（带眼睛，眼睛朝向移动方向）
   * 4. 渐变色的蛇身（头部最亮，尾部最暗）
   */
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const snake = snakeRef.current
    const food = foodRef.current

    // 清空画布
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // 画半透明网格线（画出"棋盘"的感觉）
    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    ctx.lineWidth = 0.5
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath()
      ctx.moveTo(i * CELL_SIZE, 0)
      ctx.lineTo(i * CELL_SIZE, CANVAS_SIZE)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i * CELL_SIZE)
      ctx.lineTo(CANVAS_SIZE, i * CELL_SIZE)
      ctx.stroke()
    }

    // 画食物（带脉冲动画效果——食物会一胀一缩，像在呼吸）
    if (food) {
      // pulse 在 0.85 ~ 1.15 之间正弦波变化，频率 ~3Hz
      const pulse = 1 + 0.15 * Math.sin(Date.now() / 200)
      const foodCx = food.x * CELL_SIZE + CELL_SIZE / 2
      const foodCy = food.y * CELL_SIZE + CELL_SIZE / 2
      const foodR = (CELL_SIZE / 2 - 2) * pulse

      ctx.fillStyle = '#ff4757'
      ctx.shadowColor = '#ff4757'
      ctx.shadowBlur = 8
      ctx.beginPath()
      ctx.arc(foodCx, foodCy, foodR, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }

    // 画蛇
    snake.forEach((p, i) => {
      const x = p.x * CELL_SIZE
      const y = p.y * CELL_SIZE
      const padding = 1

      if (i === 0) {
        // 蛇头：亮绿色 + 发光效果（shadowBlur）
        ctx.fillStyle = '#7bed9f'
        ctx.shadowColor = '#7bed9f'
        ctx.shadowBlur = 6
        ctx.beginPath()
        ctx.roundRect(x + padding, y + padding, CELL_SIZE - padding * 2, CELL_SIZE - padding * 2, 6)
        ctx.fill()
        ctx.shadowBlur = 0

        // 眼睛
        const eyeR = 2.5
        const dir = directionRef.current
        ctx.fillStyle = '#1a1a2e'
        let ex1: number, ey1: number, ex2: number, ey2: number
        if (dir.x === 1) {
          ex1 = x + CELL_SIZE - 6; ey1 = y + 6; ex2 = x + CELL_SIZE - 6; ey2 = y + CELL_SIZE - 6
        } else if (dir.x === -1) {
          ex1 = x + 6; ey1 = y + 6; ex2 = x + 6; ey2 = y + CELL_SIZE - 6
        } else if (dir.y === -1) {
          ex1 = x + 6; ey1 = y + 6; ex2 = x + CELL_SIZE - 6; ey2 = y + 6
        } else {
          ex1 = x + 6; ey1 = y + CELL_SIZE - 6; ex2 = x + CELL_SIZE - 6; ey2 = y + CELL_SIZE - 6
        }
        ctx.beginPath(); ctx.arc(ex1, ey1, eyeR, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.arc(ex2, ey2, eyeR, 0, Math.PI * 2); ctx.fill()
      } else {
        // 蛇身：从亮绿渐变到深绿色，越靠近尾巴越暗
        const ratio = i / Math.max(snake.length - 1, 1)
        const r = Math.round(72 + ratio * (46 - 72))
        const g = Math.round(219 + ratio * (213 - 219))
        const b = Math.round(75 + ratio * (25 - 75))
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.beginPath()
        ctx.roundRect(x + padding, y + padding, CELL_SIZE - padding * 2, CELL_SIZE - padding * 2, 5)
        ctx.fill()
      }
    })
  }, [canvasRef])

  // ====== 游戏主循环（每一帧执行一次） ======
  /**
   * 这是游戏的核心逻辑，每帧按顺序执行以下检测：
   * 1. 读取玩家输入的方向
   * 2. 计算蛇头新位置
   * 3. 撞墙检测 → Game Over
   * 4. 吃食物判定 → 蛇增长、加速、生成新食物
   * 5. 没吃到食物 → 去尾（蛇移动）
   * 6. 撞自己检测 → Game Over
   * 7. 通关检测 → 蛇占满所有格子 → You Win
   * 8. 安排下一帧（setTimeout 递归调用自己）
   */
  const tick = useCallback(() => {
    // 1. 读取玩家输入的方向
    const currentDirection = nextDirectionRef.current
    directionRef.current = currentDirection

    // 2. 计算蛇头新位置
    const newHead = moveSnakeHead(snakeRef.current[0], currentDirection)

    // 3. 撞墙检测
    if (isWallCollision(newHead, GRID_SIZE)) {
      updateStatus('over')
      return
    }

    // 4. 吃食物判定
    const ate = isEating(newHead, foodRef.current)

    // 5. 构建新蛇身
    const newSnake = ate
      ? [newHead, ...snakeRef.current]   // 吃到 → 加头不去尾（增长）
      : (() => {                          // 没吃到 → 加头去尾（移动）
          const moved = [newHead, ...snakeRef.current]
          moved.pop()
          return moved
        })()

    if (ate) {
      updateScore(scoreRef.current + 1)
      speedRef.current = calcNewSpeed(speedRef.current, SPEED_STEP)

      // 通关检测
      if (isWin(newSnake.length, MAX_CELLS)) {
        snakeRef.current = newSnake
        draw()
        updateStatus('win')
        return
      }

      // 生成新食物
      const newFood = spawnFood()
      if (newFood === null) {
        snakeRef.current = newSnake
        draw()
        updateStatus('win')
        return
      }
      foodRef.current = newFood
    }

    // 6. 撞自己检测
    if (isSelfCollision(newHead, newSnake)) {
      updateStatus('over')
      return
    }

    snakeRef.current = newSnake
    // 7. 重绘画面
    draw()

    // 8. 安排下一帧
    if (statusRef.current === 'running') {
      timerRef.current = window.setTimeout(tick, speedRef.current)
    }
  }, [draw, spawnFood, updateScore, updateStatus])

  // ====== 开始游戏 ======
  const startGame = useCallback(() => {
    // 防止重复启动：如果有旧游戏在跑，先清理旧的计时器
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    // 初始化蛇：放在棋盘中央，蛇头朝右，共 3 格长
    const center = Math.floor(GRID_SIZE / 2)
    snakeRef.current = [
      { x: center, y: center },          // 蛇头
      { x: center - 1, y: center },      // 身体
      { x: center - 2, y: center }       // 尾巴
    ]
    // 使用 nextDirectionRef 中已有的方向（键盘已存入），不硬编码
    directionRef.current = nextDirectionRef.current
    speedRef.current = INITIAL_SPEED
    updateScore(0)
    const food = spawnFood()
    if (food) foodRef.current = food
    updateStatus('running')
    draw()
    timerRef.current = window.setTimeout(tick, speedRef.current)
  }, [draw, spawnFood, tick, updateScore, updateStatus])

  // ====== 暂停 / 继续 ======
  const togglePause = useCallback(() => {
    if (statusRef.current === 'running') {
      if (timerRef.current) clearTimeout(timerRef.current)
      updateStatus('paused')
    } else if (statusRef.current === 'paused') {
      updateStatus('running')
      timerRef.current = window.setTimeout(tick, speedRef.current)
    }
  }, [tick, updateStatus])

  // ====== 键盘事件处理 ======
  /**
   * 监听全局键盘事件（不局限于 Canvas）：
   * - 方向键 / WASD → 改变蛇的移动方向（不允许 180 度掉头）
   * - 空格键 → 开始 / 暂停 / 继续
   * - idle 或 over 状态下按方向键 → 直接开始新游戏
   */
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const dir = getDirection(e.key)
      if (dir) {
        e.preventDefault()
        // 不允许 180 度掉头
        if (!isOppositeDirection(directionRef.current, dir)) {
          nextDirectionRef.current = dir
        }
        if (statusRef.current === 'idle' || statusRef.current === 'over') {
          startGame()
        }
        return
      }
      if (isSpaceKey(e.key)) {
        e.preventDefault()
        if (statusRef.current === 'idle' || statusRef.current === 'over') {
          startGame()
        } else {
          togglePause()
        }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [startGame, togglePause])

  // ====== 初始绘制 ======
  useEffect(() => {
    draw()
  }, [draw])

  // ====== 清理 ======
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { score, highScore, status, startGame, togglePause }
}

// ====== 组件 ======
export default function SnakeGame(): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { score, highScore, status, startGame, togglePause } = useSnakeGame(canvasRef)

  const statusTag: Record<string, { color: string; text: string }> = {
    idle: { color: 'default', text: '准备中' },
    running: { color: 'success', text: '游戏中' },
    paused: { color: 'warning', text: '暂停中' },
    over: { color: 'error', text: '游戏结束' },
    win: { color: 'purple', text: '🎉 恭喜通关！' }
  }

  const showStartBtn = status === 'idle' || status === 'over'
  const showPauseBtn = status === 'running'
  const showResumeBtn = status === 'paused'

  return (
    <div style={{ maxWidth: 500, margin: '0 auto' }}>
      {/* 得分面板 */}
      <Card size="small" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
          <Statistic
            title="当前得分"
            value={score}
            prefix="🍎"
            valueStyle={{ color: '#7bed9f', fontSize: 28 }}
          />
          <Statistic
            title={<span><TrophyOutlined style={{ color: '#ffa502' }} /> 最高记录</span>}
            value={highScore}
            valueStyle={{ color: '#ffa502', fontSize: 28 }}
          />
          <Tag color={statusTag[status]?.color || 'default'} style={{ fontSize: 14, padding: '2px 12px' }}>
            {statusTag[status]?.text || status}
          </Tag>
        </div>
      </Card>

      {/* 游戏画布 */}
      <Card
        styles={{ body: { padding: 0, display: 'flex', justifyContent: 'center' } }}
        style={{ marginBottom: 12 }}
      >
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          style={{
            display: 'block',
            borderRadius: 6,
            cursor: 'crosshair',
            maxWidth: '100%'
          }}
        />
      </Card>

      {/* 控制按钮 */}
      <Card size="small">
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          {showStartBtn && (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={startGame}
              size="large"
            >
              {status === 'over' ? '再来一局' : '开始游戏'}
            </Button>
          )}
          {showPauseBtn && (
            <Button
              icon={<PauseCircleOutlined />}
              onClick={togglePause}
              size="large"
            >
              暂停
            </Button>
          )}
          {showResumeBtn && (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={togglePause}
              size="large"
            >
              继续
            </Button>
          )}
          {status === 'win' && (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={startGame}
              size="large"
            >
              🎉 再来一局
            </Button>
          )}
        </div>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Space size="large">
            <Text type="secondary">
              <kbd>↑↓←→</kbd> 或 <kbd>WASD</kbd> 控制方向
            </Text>
            <Text type="secondary">
              <kbd>空格</kbd> 暂停 / 继续
            </Text>
          </Space>
        </div>
      </Card>
    </div>
  )
}
