/**
 * CategoryPage 组件单元测试
 * 测试分类管理页面的核心逻辑
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ====== Mock zustand store ======
const mockStore = {
  expenseLevel1: [
    { id: 1, type: 'expense' as const, name: '餐饮', parentId: null, icon: '🍜', sortOrder: 1, isPreset: true },
    { id: 99, type: 'expense' as const, name: '自定义', parentId: null, icon: '📦', sortOrder: 100, isPreset: false },
  ],
  expenseLevel2Map: {
    1: [
      { id: 2, type: 'expense' as const, name: '早餐', parentId: 1, icon: '☕', sortOrder: 1, isPreset: true },
    ],
  } as Record<number, Array<{
    id: number; type: 'expense'; name: string; parentId: number | null; icon: string; sortOrder: number; isPreset: boolean
  }>>,
  incomeLevel1: [
    { id: 10, type: 'income' as const, name: '职业收入', parentId: null, icon: '💼', sortOrder: 1, isPreset: true },
  ],
  incomeLevel2Map: {} as Record<number, Array<{
    id: number; type: 'income'; name: string; parentId: number | null; icon: string; sortOrder: number; isPreset: boolean
  }>>,
  addCategory: vi.fn(),
  updateCategory: vi.fn(),
  removeCategory: vi.fn(),
  reloadCategories: vi.fn(),
}

vi.mock('../stores/useAppStore', () => ({
  useAppStore: (selector?: (state: typeof mockStore) => unknown) => {
    if (selector) return selector(mockStore)
    return mockStore
  },
}))

import CategoryPage from './CategoryPage'
import React from 'react'

beforeEach(() => {
  vi.clearAllMocks()
  mockStore.reloadCategories.mockResolvedValue(undefined)
})

// ============================================================
// 渲染测试
// ============================================================
describe('CategoryPage — 渲染', () => {
  it('渲染分类管理标题', () => {
    render(<CategoryPage />)
    expect(screen.getByText('📂 分类管理')).toBeDefined()
  })

  it('显示预设一级分类名称', () => {
    render(<CategoryPage />)
    expect(screen.getByText('餐饮')).toBeDefined()
  })

  it('显示预设二级分类名称', () => {
    render(<CategoryPage />)
    expect(screen.getByText('早餐')).toBeDefined()
  })

  it('预设分类显示锁定标记 "预置"', () => {
    render(<CategoryPage />)
    const presetTags = screen.getAllByText('预置')
    expect(presetTags.length).toBeGreaterThan(0)
  })

  it('显示 "添加一级分类" 按钮', () => {
    render(<CategoryPage />)
    expect(screen.getByText('添加一级分类')).toBeDefined()
  })

  it('显示提示文字', () => {
    render(<CategoryPage />)
    expect(screen.getByText(/管理记账分类/)).toBeDefined()
  })
})

// ============================================================
// Tab 切换测试
// ============================================================
describe('CategoryPage — Tab 切换', () => {
  it('默认显示支出分类 Tab', () => {
    render(<CategoryPage />)
    expect(screen.getByText('💸 支出分类')).toBeDefined()
  })

  it('可以切换到收入分类 Tab', async () => {
    render(<CategoryPage />)
    await userEvent.click(screen.getByText('💰 收入分类'))
    // 切换后页面上应该能查到收入分类的内容
    const incomeItems = screen.getAllByText('职业收入')
    expect(incomeItems.length).toBeGreaterThan(0)
  })

  it('切换回支出分类后显示支出内容', async () => {
    render(<CategoryPage />)
    // 先切换到收入
    await userEvent.click(screen.getByText('💰 收入分类'))
    // 再切换回来
    await userEvent.click(screen.getByText('💸 支出分类'))
    const expenseItems = screen.getAllByText('餐饮')
    expect(expenseItems.length).toBeGreaterThan(0)
  })
})

// ============================================================
// 二级分类添加按钮
// ============================================================
describe('CategoryPage — 二级分类操作入口', () => {
  it('一级分类下面显示添加二级分类按钮', () => {
    render(<CategoryPage />)
    expect(screen.getByText('添加「餐饮」下的二级分类')).toBeDefined()
  })
})

// ============================================================
// 自定义分类：可编辑可删除
// ============================================================
describe('CategoryPage — 自定义分类按钮', () => {
  it('自定义分类（非预设）有编辑按钮', () => {
    render(<CategoryPage />)
    // 自定义分类有编辑和删除操作
    const editButtons = screen.getAllByLabelText('edit')
    expect(editButtons.length).toBeGreaterThan(0)
  })

  it('自定义分类有删除按钮', () => {
    render(<CategoryPage />)
    const deleteButtons = screen.getAllByLabelText('delete')
    expect(deleteButtons.length).toBeGreaterThan(0)
  })
})
