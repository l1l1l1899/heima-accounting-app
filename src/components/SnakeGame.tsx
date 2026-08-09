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

const { Text } = Typography

// ====== 游戏配置常量 ======
// 网格大小：20×20 = 400 个格子，蛇填满所有格子 = 通关
const GRID_SIZE = 20
// 每个格子的像素大小（Canvas 绘制用）
const CELL_SIZE = 22
// Canvas 总尺寸
const CANVAS_SIZE = GRID_SIZE * CELL_SIZE  // 440px
// 初始移动速度：150ms/帧（约 6.7 帧/秒）
const INITIAL_SPEED = 150
// 最快速度：50ms/帧（约 20 帧/秒，再快就太难了）
const MIN_SPEED = 50
// 每吃一个食物，速度减少 3ms（蛇变快一点）
const SPEED_STEP = 3
// 最大格子数 = 蛇能占满整个网格时的长度
const MAX_CELLS = GRID_SIZE * GRID_SIZE  // 400

/**
 * 方向键到方向向量的映射
 *
 * 方向向量 {x, y} 的含义：
 * - x: 水平移动，1=向右一格，-1=向左一格，0=不左右移动
 * - y: 垂直移动，1=向下一格，-1=向上一格，0=不上下移动
 *
 * 同时支持方向键（ArrowUp/Down/Left/Right）和 WASD 键
 * 键盘输入会先转小写再匹配，所以大小写 WASD 都可以
 */
const DIR: Record<string, { x: number; y: number }> = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 }
}

/** 坐标点类型 */
type Point = { x: number; y: number }
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

  // 同步 score（用 ref 避免闭包过期，消除 highScore 依赖级联）
  const updateScore = useCallback((s: number) => {
    scoreRef.current = s
    setScore(s)
    if (s > highScoreRef.current) {
      highScoreRef.current = s
      setHighScore(s)
      try { localStorage.setItem('snake-high-score', String(s)) } catch { /* quota unlikely but ignore */ }
    }
  }, [])

  // ====== 生成食物（在未被蛇占据的空格中随机选一个） ======
  /**
   * 遍历整个网格，找到所有不被蛇身占据的格子，
   * 从中随机选一个放置新食物
   * 如果所有格子都被占满了 → 返回 null（表示通关）
   */
  const spawnFood = useCallback((): Point | null => {
    // 把蛇身所有格子坐标收集到 Set，O(1) 查重
    const occupied = new Set(snakeRef.current.map(p => `${p.x},${p.y}`))
    const candidates: Point[] = []
    // 遍历整个网格，筛出所有空格子
    for (let x = 0; x < GRID_SIZE; x++) {
      for (let y = 0; y < GRID_SIZE; y++) {
        if (!occupied.has(`${x},${y}`)) {
          candidates.push({ x, y })
        }
      }
    }
    if (candidates.length === 0) return null  // 格子已满
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

    const head = snakeRef.current[0]
    // 2. 计算蛇头新位置（当前头坐标 + 方向向量）
    const newHead: Point = {
      x: head.x + currentDirection.x,
      y: head.y + currentDirection.y
    }

    // 3. 撞墙检测：新头坐标超出网格边界 → Game Over
    if (newHead.x < 0 || newHead.x >= GRID_SIZE || newHead.y < 0 || newHead.y >= GRID_SIZE) {
      updateStatus('over')
      return
    }

    // 4. 吃食物判定（在构建新蛇身之前，比较新头坐标和食物坐标）
    const ate = newHead.x === foodRef.current.x && newHead.y === foodRef.current.y

    // 构建新蛇身：新头插在最前面
    const newSnake = [newHead, ...snakeRef.current]

    if (ate) {
      // 5a. 吃到了——不去尾（蛇身自然 +1），加分并加速
      updateScore(scoreRef.current + 1)
      // 速度加快：减少帧间隔时间，但不低于 MIN_SPEED
      speedRef.current = Math.max(MIN_SPEED, speedRef.current - SPEED_STEP)

      // 通关检测：蛇填满所有格子
      if (newSnake.length >= MAX_CELLS) {
        snakeRef.current = newSnake
        draw()
        updateStatus('win')
        return
      }

      // 生成新食物
      const newFood = spawnFood()
      if (newFood === null) {
        // 无空位可放食物 = 通关
        snakeRef.current = newSnake
        draw()
        updateStatus('win')
        return
      }
      foodRef.current = newFood
    } else {
      // 5b. 没吃到——去掉尾巴（蛇整体向前移动一格）
      newSnake.pop()
    }

    // 6. 撞自己检测（去尾之后再做，否则蛇尾刚移开的位置可能被误判为碰撞）
    if (newSnake.slice(1).some(p => p.x === newHead.x && p.y === newHead.y)) {
      updateStatus('over')
      return
    }

    snakeRef.current = newSnake
    // 7. 重绘画面
    draw()

    // 8. 安排下一帧（游戏循环：setTimeout 递归调用 tick）
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
      // 归一化：大写 WASD → 小写
      // 先直接匹配，再尝试转小写匹配（兼容 WASD 大小写）
      const dir = DIR[e.key] ?? (e.key.length === 1 ? DIR[e.key.toLowerCase()] : undefined)
      if (dir) {
        e.preventDefault()
        // 不允许 180 度掉头：新方向和当前方向不能完全相反
        // 如当前向右(1,0)，新方向不能是向左(-1,0)
        const current = directionRef.current
        if (dir.x !== -current.x || dir.y !== -current.y) {
          nextDirectionRef.current = dir
        }
        // 如果是 idle 或 over 状态，按方向键直接开始
        if (statusRef.current === 'idle' || statusRef.current === 'over') {
          startGame()
        }
        return
      }
      if (e.key === ' ') {
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
