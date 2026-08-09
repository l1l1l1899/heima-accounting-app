/**
 * 首页仪表盘 —— 记账应用的"驾驶舱"
 *
 * 这个页面展示三块内容：
 * 1. 月份导航 —— 左右箭头切换月份，查看历史记录
 * 2. 月度概览卡片 —— 收入、支出、结余三张大数字卡片
 * 3. 账单明细表格 —— 当前月的每一条记录，可以删除
 *
 * 类比：就像银行 App 的首页，一打开就能看到这个月花了多少钱
 */
import { useEffect } from 'react'
import { Card, Col, Row, Statistic, Table, Tag, Typography, Empty, Button } from 'antd'
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  WalletOutlined,
  LeftOutlined,
  RightOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import { useAppStore } from '../stores/useAppStore'
import type { Transaction } from '../types'
import dayjs from 'dayjs'
import Modal from 'antd/es/modal'

const { Title } = Typography

export default function HomePage(): JSX.Element {
  // 从全局状态中取出首页需要的数据和操作
  const {
    monthlyOverview,   // 本月收入/支出/结余
    transactions,      // 本月的账目列表
    loading,           // 数据是否加载中
    currentMonth,      // 当前查看的年月
    loadAll,           // 加载全部数据
    setCurrentMonth,   // 切换到指定月份
    removeTransaction  // 删除一条账目
  } = useAppStore()

  // 页面打开时自动加载数据
  useEffect(() => {
    loadAll()
  }, [])

  // ====== 月份导航 ======
  // 用 dayjs 方便地计算上个月和下个月
  const currentDate = dayjs(`${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}-01`)
  const prevMonth = currentDate.subtract(1, 'month')   // 上一个月
  const nextMonth = currentDate.add(1, 'month')         // 下一个月
  // 判断当前查看的是否为"本月"（不能查看未来的月份）
  const isCurrentMonth = currentMonth.year === dayjs().year() && currentMonth.month === dayjs().month() + 1

  /** 切换到指定年月 */
  const goToMonth = (year: number, month: number): void => {
    setCurrentMonth(year, month)
  }

  // ====== 删除确认弹窗 ======
  /**
   * 点击删除按钮时，先弹出确认框（防止误删）
   * 用户确认后才真正执行删除
   */
  const handleDelete = (record: Transaction): void => {
    Modal.confirm({
      title: '确认删除这条记录？',
      icon: <ExclamationCircleOutlined />,
      content: `${record.category_l1} / ${record.category_l2} — ¥${record.amount.toFixed(2)}`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await removeTransaction(record.id)
      }
    })
  }

  // ====== 表格列定义 ======
  // 定义账单明细表格的每一列：日期、类型、分类、金额、备注、操作
  const columns = [
    {
      title: '日期',
      dataIndex: 'date',
      key: 'date',
      width: 110
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 70,
      // 支出显示红色标签，收入显示绿色标签
      render: (type: string) => (
        <Tag color={type === 'expense' ? 'red' : 'green'}>
          {type === 'expense' ? '支出' : '收入'}
        </Tag>
      )
    },
    {
      title: '分类',
      key: 'category',
      width: 120,
      // 显示 "一级分类 / 二级分类" 的格式
      render: (_: unknown, record: Transaction) =>
        `${record.category_l1} / ${record.category_l2}`
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 130,
      align: 'right' as const,
      // 支出显示红色减号，收入显示绿色加号
      render: (amount: number, record: Transaction) => (
        <span style={{ color: record.type === 'expense' ? '#ff4d4f' : '#52c41a', fontWeight: 500 }}>
          {record.type === 'expense' ? '-' : '+'}¥{amount.toFixed(2)}
        </span>
      )
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,             // 文字太长时自动省略
      render: (note: string) => note || '-'
    },
    {
      title: '',
      key: 'action',
      width: 50,
      // 每条记录右侧的红色删除按钮
      render: (_: unknown, record: Transaction) => (
        <Button
          type="text"
          danger
          size="small"
          icon={<DeleteOutlined />}
          onClick={(e) => { e.stopPropagation(); handleDelete(record) }}
        />
      )
    }
  ]

  return (
    <div>
      {/* ====== 月份导航栏 ====== */}
      {/* 左箭头 ← [2024年6月 本月] → 右箭头（如果已是本月则禁用右箭头） */}
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
        <Button
          icon={<LeftOutlined />}
          shape="circle"
          onClick={() => goToMonth(prevMonth.year(), prevMonth.month() + 1)}
        />
        <Title level={4} style={{ margin: 0, minWidth: 140, textAlign: 'center' }}>
          {currentMonth.year}年{currentMonth.month}月
          {/* 如果是当前月份，显示蓝色"本月"标记 */}
          {isCurrentMonth && <span style={{ fontSize: 12, color: '#1677ff', marginLeft: 4 }}>本月</span>}
        </Title>
        <Button
          icon={<RightOutlined />}
          shape="circle"
          disabled={isCurrentMonth}   // 不能去到未来月份
          onClick={() => goToMonth(nextMonth.year(), nextMonth.month() + 1)}
        />
      </div>

      {/* ====== 三张概览卡片：收入 / 支出 / 结余 ====== */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {/* 收入卡片：绿色，向上箭头 */}
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="收入"
              value={monthlyOverview?.totalIncome || 0}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#52c41a' }}
              suffix={<ArrowUpOutlined />}
            />
          </Card>
        </Col>
        {/* 支出卡片：红色，向下箭头 */}
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="支出"
              value={monthlyOverview?.totalExpense || 0}
              precision={2}
              prefix="¥"
              valueStyle={{ color: '#ff4d4f' }}
              suffix={<ArrowDownOutlined />}
            />
          </Card>
        </Col>
        {/* 结余卡片：正数蓝色，负数红色 */}
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="结余"
              value={monthlyOverview?.balance || 0}
              precision={2}
              prefix="¥"
              valueStyle={{ color: (monthlyOverview?.balance || 0) >= 0 ? '#1677ff' : '#ff4d4f' }}
              suffix={<WalletOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* ====== 账单明细表格 ====== */}
      <Card title={<Title level={5} style={{ margin: 0 }}>账单明细</Title>}>
        {/* 有数据时显示表格，没数据时显示空状态引导 */}
        {transactions.length > 0 ? (
          <Table
            dataSource={transactions}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 10, showTotal: (total) => `共 ${total} 条` }}
            size="middle"
            locale={{ emptyText: '暂无记录' }}
          />
        ) : (
          <Empty description="这个月还没有记录，点击左侧「记一笔」开始记账吧！" />
        )}
      </Card>
    </div>
  )
}
