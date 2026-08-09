/**
 * useAppStore 状态管理单元测试
 * 通过 mock 数据库层来测试 store 的逻辑
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ====== Mock 数据库 API ======
vi.mock('../database/api', () => ({
  getLevel1Categories: vi.fn(),
  getLevel2Categories: vi.fn(),
  getTransactions: vi.fn(),
  getMonthlyOverview: vi.fn(),
  getCategoryStats: vi.fn(),
  getMonthlyTrends: vi.fn(),
  addTransaction: vi.fn(),
  deleteTransaction: vi.fn(),
  addCategory: vi.fn(),
  updateCategory: vi.fn(),
  deleteCategory: vi.fn(),
}))

import * as db from '../database/api'
import { useAppStore } from './useAppStore'
import type { Category } from '../types'

// ====== 辅助函数：重置 store ======
function resetStore() {
  useAppStore.setState({
    expenseLevel1: [],
    expenseLevel2Map: {},
    incomeLevel1: [],
    incomeLevel2Map: {},
    transactions: [],
    currentMonth: { year: 2024, month: 6 },
    monthlyOverview: null,
    categoryStats: [],
    monthlyTrends: [],
    loading: false,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  resetStore()
})

// ============================================================
// 初始状态 测试
// ============================================================
describe('useAppStore — 初始状态', () => {
  it('分类列表初始为空', () => {
    const state = useAppStore.getState()
    expect(state.expenseLevel1).toEqual([])
    expect(state.incomeLevel1).toEqual([])
  })

  it('账目列表初始为空', () => {
    const state = useAppStore.getState()
    expect(state.transactions).toEqual([])
  })

  it('统计初始为 null', () => {
    const state = useAppStore.getState()
    expect(state.monthlyOverview).toBeNull()
  })

  it('loading 初始为 false', () => {
    const state = useAppStore.getState()
    expect(state.loading).toBe(false)
  })
})

// ============================================================
// setCurrentMonth 测试
// ============================================================
describe('useAppStore — setCurrentMonth 切换月份', () => {
  it('切换到指定年月份', () => {
    useAppStore.getState().setCurrentMonth(2025, 3)
    const state = useAppStore.getState()
    expect(state.currentMonth).toEqual({ year: 2025, month: 3 })
  })
})

// ============================================================
// loadCategories 测试
// ============================================================
describe('useAppStore — loadCategories 加载分类', () => {
  it('加载支出分类到 store', async () => {
    const mockExpenseL1: Category[] = [
      { id: 1, type: 'expense', name: '餐饮', parentId: null, icon: '🍜', sortOrder: 1, isPreset: true },
    ]
    const mockExpenseL2: Category[] = [
      { id: 2, type: 'expense', name: '早餐', parentId: 1, icon: '☕', sortOrder: 1, isPreset: true },
    ]

    vi.mocked(db.getLevel1Categories)
      .mockResolvedValueOnce(mockExpenseL1)  // expense
      .mockResolvedValueOnce([])              // income
    vi.mocked(db.getLevel2Categories).mockResolvedValue(mockExpenseL2)

    await useAppStore.getState().loadCategories()
    const state = useAppStore.getState()

    expect(state.expenseLevel1).toEqual(mockExpenseL1)
    expect(state.expenseLevel2Map[1]).toEqual(mockExpenseL2)
  })
})

// ============================================================
// addTransaction 测试
// ============================================================
describe('useAppStore — addTransaction 添加账目', () => {
  it('添加支出后调用数据库并重新加载', async () => {
    vi.mocked(db.addTransaction).mockResolvedValue(1)
    vi.mocked(db.getTransactions).mockResolvedValue([])
    vi.mocked(db.getMonthlyOverview).mockResolvedValue({
      totalIncome: 10000, totalExpense: 500, balance: 9500, year: 2024, month: 6,
    })
    vi.mocked(db.getCategoryStats).mockResolvedValue([])
    vi.mocked(db.getMonthlyTrends).mockResolvedValue([])

    await useAppStore.getState().addTransaction({
      type: 'expense',
      amount: 50,
      categoryL1: '餐饮',
      categoryL2: '午餐',
      date: '2024-06-15',
      note: '测试午餐',
    })

    expect(db.addTransaction).toHaveBeenCalledTimes(1)
    expect(db.getTransactions).toHaveBeenCalled()
    expect(db.getMonthlyOverview).toHaveBeenCalled()
  })
})

// ============================================================
// removeTransaction 测试
// ============================================================
describe('useAppStore — removeTransaction 删除账目', () => {
  it('删除后调用数据库并重新加载', async () => {
    vi.mocked(db.deleteTransaction).mockResolvedValue(undefined)
    vi.mocked(db.getTransactions).mockResolvedValue([])
    vi.mocked(db.getMonthlyOverview).mockResolvedValue({
      totalIncome: 10000, totalExpense: 0, balance: 10000, year: 2024, month: 6,
    })
    vi.mocked(db.getCategoryStats).mockResolvedValue([])
    vi.mocked(db.getMonthlyTrends).mockResolvedValue([])

    await useAppStore.getState().removeTransaction(1)

    expect(db.deleteTransaction).toHaveBeenCalledWith(1)
    expect(db.getTransactions).toHaveBeenCalled()
  })
})

// ============================================================
// addCategory 测试
// ============================================================
describe('useAppStore — addCategory 添加分类', () => {
  it('添加分类后重新加载', async () => {
    vi.mocked(db.addCategory).mockResolvedValue(100)
    vi.mocked(db.getLevel1Categories).mockResolvedValue([])

    await useAppStore.getState().addCategory({
      type: 'expense',
      name: '宠物',
      icon: '🐱',
      parentId: null,
      sortOrder: 100,
    })

    expect(db.addCategory).toHaveBeenCalledWith({
      type: 'expense',
      name: '宠物',
      icon: '🐱',
      parentId: null,
      sortOrder: 100,
    })
    expect(db.getLevel1Categories).toHaveBeenCalled()
  })
})

// ============================================================
// updateCategory 测试
// ============================================================
describe('useAppStore — updateCategory 更新分类', () => {
  it('更新分类名称和图标后重新加载', async () => {
    vi.mocked(db.updateCategory).mockResolvedValue(1)
    vi.mocked(db.getLevel1Categories).mockResolvedValue([])

    await useAppStore.getState().updateCategory(5, '新名称', '⭐')

    expect(db.updateCategory).toHaveBeenCalledWith(5, '新名称', '⭐')
  })
})

// ============================================================
// removeCategory 测试
// ============================================================
describe('useAppStore — removeCategory 删除分类', () => {
  it('删除分类后重新加载', async () => {
    vi.mocked(db.deleteCategory).mockResolvedValue(1)
    vi.mocked(db.getLevel1Categories).mockResolvedValue([])

    await useAppStore.getState().removeCategory(10)

    expect(db.deleteCategory).toHaveBeenCalledWith(10)
  })
})

// ============================================================
// loadAll 测试
// ============================================================
describe('useAppStore — loadAll 全量加载', () => {
  it('同时加载分类、账目和统计', async () => {
    vi.mocked(db.getLevel1Categories).mockResolvedValue([])
    vi.mocked(db.getTransactions).mockResolvedValue([])
    vi.mocked(db.getMonthlyOverview).mockResolvedValue({
      totalIncome: 0, totalExpense: 0, balance: 0, year: 2024, month: 6,
    })
    vi.mocked(db.getCategoryStats).mockResolvedValue([])
    vi.mocked(db.getMonthlyTrends).mockResolvedValue([])

    await useAppStore.getState().loadAll()

    expect(db.getLevel1Categories).toHaveBeenCalled()
    expect(db.getTransactions).toHaveBeenCalled()
    expect(db.getMonthlyOverview).toHaveBeenCalled()
  })
})
