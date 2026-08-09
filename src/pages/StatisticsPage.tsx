/**
 * 统计页面 —— 用图表展示你的收支情况
 *
 * 这个页面包含三大块：
 * 1. 支出分类饼图 —— 一眼看出钱花在哪了
 * 2. 月度趋势折线图 —— 看最近 12 个月收入和支出的变化趋势
 * 3. 月度概览卡片 —— 本月总收入、总支出、结余
 */
import { useEffect } from 'react'
import { Card, Col, Row, Empty, Spin, Typography } from 'antd'
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer
} from 'recharts'
import { useAppStore } from '../stores/useAppStore'

const { Title } = Typography

/**
 * 饼图颜色板 —— 每个扇区用一种颜色
 * 按顺序循环使用，一共有 15 种颜色，足够覆盖所有一级分类
 */
const COLORS = [
  '#1677ff', '#52c41a', '#fa8c16', '#ff4d4f', '#722ed1',
  '#13c2c2', '#eb2f96', '#faad14', '#2f54eb', '#a0d911',
  '#fa541c', '#9254de', '#36cfc9', '#f759ab', '#d48806'
]

/**
 * 饼图的扇区标签 —— 显示 "分类名 百分比%"
 *
 * 类比：就像把一块披萨切成几块，每块上面标注是谁的、占多少
 *
 * @param name - 分类名称（如"餐饮"）
 * @param percent - 占比（0~1 之间的小数，如 0.35 表示 35%）
 * @returns 格式化的标签文本（如"餐饮 35%"）
 */
function renderCustomLabel({ name, percent }: { name: string; percent: number }): string {
  return `${name} ${(percent * 100).toFixed(0)}%`
}

export default function StatisticsPage(): JSX.Element {
  // 从全局状态中取出统计数据
  const {
    categoryStats,    // 各一级分类的金额和百分比（饼图用）
    monthlyTrends,    // 近 12 个月的收支趋势（折线图用）
    monthlyOverview,  // 本月总收入、总支出、结余
    currentMonth,     // 当前查看的年月
    loading,          // 数据是否正在加载中
    loadStatistics    // 加载统计数据的函数
  } = useAppStore()

  // 页面打开时自动加载统计数据（只加载一次）
  useEffect(() => {
    loadStatistics()
  }, [])

  // 把 categoryStats 转成 Recharts 饼图需要的格式
  // categoryStats 里每项有 categoryL1（分类名）、amount（金额）、percentage（百分比）
  // 饼图只需要 name（名称）和 value（数值）
  const pieData = categoryStats.map(s => ({
    name: s.categoryL1,
    value: s.amount
  }))

  // 把 monthlyTrends 转成 Recharts 折线图需要的格式
  // 每条数据包含：month（月份）、收入金额、支出金额
  const trendData = monthlyTrends.map(t => ({
    month: t.label,
    支出: t.expense,
    收入: t.income
  }))

  // 数据加载中时显示旋转加载动画
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    )
  }

  return (
    <div>
      {/* 用 Row/Col 布局实现响应式：大屏幕左右并排，小屏幕上下堆叠 */}
      <Row gutter={[16, 16]}>
        {/* ====== 左侧：支出分类饼图 ====== */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Title level={5} style={{ margin: 0 }}>
                {currentMonth.year}年{currentMonth.month}月 支出分类占比
              </Title>
            }
          >
            {/* 有数据时显示饼图，没数据时显示空状态提示 */}
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={360}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"                    // 圆心水平居中
                    cy="50%"                    // 圆心垂直居中
                    outerRadius={120}           // 饼图半径
                    label={renderCustomLabel}   // 扇区标签（显示分类名+百分比）
                    dataKey="value"             // 用数据的 value 字段决定扇区大小
                  >
                    {/* 给每个扇区分配不同的颜色 */}
                    {pieData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}  // 颜色循环使用
                      />
                    ))}
                  </Pie>
                  {/* 鼠标悬停时显示金额 */}
                  <Tooltip formatter={(value: number) => `¥${value.toFixed(2)}`} />
                  {/* 图例：显示每种颜色对应的分类名 */}
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="本月没有支出记录" />
            )}
          </Card>
        </Col>

        {/* ====== 右侧：月度收支趋势折线图 ====== */}
        <Col xs={24} lg={12}>
          <Card
            title={
              <Title level={5} style={{ margin: 0 }}>
                近12个月收支趋势
              </Title>
            }
          >
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={trendData}>
                  {/* 灰色虚线网格，方便对照数值 */}
                  <CartesianGrid strokeDasharray="3 3" />
                  {/* X 轴：月份文字 */}
                  <XAxis dataKey="month" fontSize={12} />
                  {/* Y 轴：金额 */}
                  <YAxis fontSize={12} />
                  {/* 鼠标悬停显示具体金额 */}
                  <Tooltip formatter={(value: number) => `¥${value.toFixed(2)}`} />
                  <Legend />
                  {/* 收入线：绿色，代表收入 */}
                  <Line
                    type="monotone"       // 平滑曲线
                    dataKey="收入"
                    stroke="#52c41a"
                    strokeWidth={2}
                    dot={{ r: 3 }}        // 数据点小圆点
                  />
                  {/* 支出线：红色，代表支出 */}
                  <Line
                    type="monotone"
                    dataKey="支出"
                    stroke="#ff4d4f"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <Empty description="暂无数据，开始记账后这里会展示趋势图" />
            )}
          </Card>
        </Col>
      </Row>

      {/* ====== 月度概览：收入/支出/结余三栏数字 ====== */}
      {monthlyOverview && (
        <Card style={{ marginTop: 16 }}>
          <Row gutter={16} justify="space-around">
            {/* 总收入 —— 绿色，表示进账 */}
            <Col>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#999' }}>总收入</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: '#52c41a' }}>
                  ¥{monthlyOverview.totalIncome.toFixed(2)}
                </div>
              </div>
            </Col>
            {/* 总支出 —— 红色，表示花钱 */}
            <Col>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#999' }}>总支出</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: '#ff4d4f' }}>
                  ¥{monthlyOverview.totalExpense.toFixed(2)}
                </div>
              </div>
            </Col>
            {/* 结余 —— 正数为蓝色（赚了），负数为红色（超支了） */}
            <Col>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#999' }}>结余</div>
                <div style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: monthlyOverview.balance >= 0 ? '#1677ff' : '#ff4d4f'
                }}>
                  ¥{monthlyOverview.balance.toFixed(2)}
                </div>
              </div>
            </Col>
          </Row>
        </Card>
      )}
    </div>
  )
}
