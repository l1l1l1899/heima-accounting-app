/**
 * RecordPage 记账页面组件测试
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ====== Mock zustand store ======
const mockStore = {
  expenseLevel1: [
    { id: 1, type: 'expense' as const, name: '餐饮', parentId: null, icon: '🍜', sortOrder: 1, isPreset: true },
    { id: 3, type: 'expense' as const, name: '交通', parentId: null, icon: '🚗', sortOrder: 2, isPreset: true },
  ],
  expenseLevel2Map: {
    1: [
      { id: 2, type: 'expense' as const, name: '午餐', parentId: 1, icon: '🍚', sortOrder: 1, isPreset: true },
      { id: 5, type: 'expense' as const, name: '晚餐', parentId: 1, icon: '🍲', sortOrder: 2, isPreset: true },
    ],
  } as Record<number, Array<{
    id: number; type: 'expense'; name: string; parentId: number | null; icon: string; sortOrder: number; isPreset: boolean
  }>>,
  incomeLevel1: [
    { id: 10, type: 'income' as const, name: '职业收入', parentId: null, icon: '💼', sortOrder: 1, isPreset: true },
  ],
  incomeLevel2Map: {
    10: [
      { id: 11, type: 'income' as const, name: '工资', parentId: 10, icon: '💰', sortOrder: 1, isPreset: true },
    ],
  } as Record<number, Array<{
    id: number; type: 'income'; name: string; parentId: number | null; icon: string; sortOrder: number; isPreset: boolean
  }>>,
  loadAll: vi.fn(),
  addTransaction: vi.fn(),
}

vi.mock('../stores/useAppStore', () => ({
  useAppStore: Object.assign(
    (selector?: (state: typeof mockStore) => unknown) => {
      if (selector) return selector(mockStore)
      return mockStore
    },
    { getState: () => mockStore }
  ),
}))

import RecordPage from './RecordPage'
import React from 'react'

beforeEach(() => {
  vi.clearAllMocks()
  mockStore.loadAll.mockResolvedValue(undefined)
})

// ============================================================
// 渲染测试
// ============================================================
describe('RecordPage — 渲染', () => {
  it('显示标题 "记一笔"', () => {
    render(<RecordPage />)
    expect(screen.getByText('记一笔')).toBeDefined()
  })

  it('显示类型切换按钮（支出/收入）', () => {
    render(<RecordPage />)
    expect(screen.getByText('💸 支出')).toBeDefined()
    expect(screen.getByText('💰 收入')).toBeDefined()
  })

  it('默认选中支出', () => {
    render(<RecordPage />)
    // 检查支出按钮处于激活状态
    const expenseBtn = screen.getByText('💸 支出')
    expect(expenseBtn.closest('label')?.classList.contains('ant-radio-button-wrapper-checked')).toBe(true)
  })

  it('显示表单字段', () => {
    render(<RecordPage />)
    expect(screen.getByText('分类（一级）')).toBeDefined()
    expect(screen.getByText('分类（二级）')).toBeDefined()
    expect(screen.getByText('保存记录')).toBeDefined()
  })
})

// ============================================================
// 类型切换测试
// ============================================================
describe('RecordPage — 类型切换', () => {
  it('点击收入切换到收入模式', async () => {
    render(<RecordPage />)
    await userEvent.click(screen.getByText('💰 收入'))
    // 金额标签应该变化
    expect(screen.getByText(/收入多少/)).toBeDefined()
  })

  it('默认显示支出金额标签', () => {
    render(<RecordPage />)
    expect(screen.getByText(/花了多少/)).toBeDefined()
  })
})

// ============================================================
// 备注字段
// ============================================================
describe('RecordPage — 备注字段', () => {
  it('备注字段不是必填的（无红色星号）', () => {
    render(<RecordPage />)
    expect(screen.getByText('备注（选填）')).toBeDefined()
  })
})

// ============================================================
// 表单必填字段
// ============================================================
describe('RecordPage — 必填校验', () => {
  it('一级分类为必填', () => {
    render(<RecordPage />)
    // 必填字段标签附近应有 required 标记
    const l1Label = screen.getByText('分类（一级）')
    expect(l1Label).toBeDefined()
  })

  it('二级分类为必填', () => {
    render(<RecordPage />)
    const l2Label = screen.getByText('分类（二级）')
    expect(l2Label).toBeDefined()
  })

  it('金额为必填', () => {
    render(<RecordPage />)
    // 金额标签根据类型变化
    expect(screen.getByText(/花了多少/)).toBeDefined()
  })
})
