/**
 * 应用全局状态管理 (Zustand)
 *
 * 这里是整个应用的"数据中心"，就像一个仓库管理员：
 * - 存储分类数据、账目数据、统计数据
 * - 提供增删改查的操作方法
 * - 所有页面都从这里读写数据
 *
 * Zustand 的原理：就像一个全局的 JS 对象，任何组件都可以直接读写，
 * 数据变了会自动通知所有用到它的组件刷新界面。
 *
 * 类比：就像一个公告栏——谁贴了新的通知（改数据），所有人都能看到更新
 */
import { create } from 'zustand'
import type { Category, Transaction, MonthlyOverview, CategoryStat, MonthlyTrend, TransactionType } from '../types'
import * as db from '../database/api'

/** 应用全局状态的类型定义 */
interface AppState {
  // ====== 分类数据 ======
  expenseLevel1: Category[]                    // 支出的一级分类列表
  expenseLevel2Map: Record<number, Category[]> // 支出的二级分类映射（一级分类ID → 二级列表）
  incomeLevel1: Category[]                     // 收入的一级分类列表
  incomeLevel2Map: Record<number, Category[]>  // 收入的二级分类映射

  // ====== 账目数据 ======
  transactions: Transaction[]                               // 当前月的账目列表
  currentMonth: { year: number; month: number }             // 当前查看的年月

  // ====== 统计数据 ======
  monthlyOverview: MonthlyOverview | null      // 月度概览（总收入/总支出/结余）
  categoryStats: CategoryStat[]                // 分类占比统计（饼图数据）
  monthlyTrends: MonthlyTrend[]                // 月度趋势（折线图数据）

  // ====== UI 状态 ======
  loading: boolean                             // 是否正在加载数据

  // ====== Actions（操作方法） ======
  loadCategories: () => Promise<void>          // 加载分类数据
  loadTransactions: () => Promise<void>        // 加载账目数据
  loadStatistics: () => Promise<void>          // 加载统计数据
  loadAll: () => Promise<void>                 // 一次性加载全部数据

  // 账目操作
  addTransaction: (input: {
    type: TransactionType
    amount: number
    categoryL1: string
    categoryL2: string
    date: string
    note?: string
  }) => Promise<void>                           // 添加一条账目
  removeTransaction: (id: number) => Promise<void>  // 删除一条账目
  setCurrentMonth: (year: number, month: number) => void  // 切换到指定月份

  // 分类管理操作
  addCategory: (input: {
    type: TransactionType
    name: string
    icon: string
    parentId: number | null
    sortOrder: number
  }) => Promise<void>                           // 添加自定义分类
  updateCategory: (id: number, name: string, icon: string) => Promise<void>  // 更新分类
  removeCategory: (id: number) => Promise<void>   // 删除分类
  reloadCategories: () => Promise<void>           // 重新加载分类
}

/**
 * 创建全局状态 store
 *
 * Zustand 的 create 函数接收一个回调，回调参数包含：
 * - set：更新状态
 * - get：读取当前状态
 */
export const useAppStore = create<AppState>((set, get) => ({
  // ====== 初始值 ======
  expenseLevel1: [],
  expenseLevel2Map: {},
  incomeLevel1: [],
  incomeLevel2Map: {},
  transactions: [],
  // 默认显示当前月份
  currentMonth: {
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1  // getMonth() 返回 0-11，需要 +1
  },
  monthlyOverview: null,
  categoryStats: [],
  monthlyTrends: [],
  loading: false,

  // ====== 数据加载 Actions ======

  /**
   * 加载分类数据
   * 分别获取支出和收入的一级分类，再逐个查它们的二级分类
   */
  loadCategories: async () => {
    try {
      const expenseL1 = await db.getLevel1Categories('expense')
      const incomeL1 = await db.getLevel1Categories('income')

      // 为每个一级分类加载其下的二级分类
      const expenseL2Map: Record<number, Category[]> = {}
      for (const cat of expenseL1) {
        expenseL2Map[cat.id] = await db.getLevel2Categories(cat.id)
      }

      const incomeL2Map: Record<number, Category[]> = {}
      for (const cat of incomeL1) {
        incomeL2Map[cat.id] = await db.getLevel2Categories(cat.id)
      }

      // 一次性更新所有分类数据
      set({
        expenseLevel1: expenseL1,
        expenseLevel2Map: expenseL2Map,
        incomeLevel1: incomeL1,
        incomeLevel2Map: incomeL2Map
      })
    } catch (err) {
      console.error('加载分类数据失败:', err)
    }
  },

  /**
   * 加载当前月份的账目列表
   * 日期范围：当月第一天到最后一天
   */
  loadTransactions: async () => {
    try {
      const { currentMonth } = get()
      // 生成月份前缀，如 "2024-06"
      const prefix = `${currentMonth.year}-${String(currentMonth.month).padStart(2, '0')}`
      const transactions = await db.getTransactions({
        startDate: `${prefix}-01`,
        endDate: `${prefix}-31`
      })
      set({ transactions })
    } catch (err) {
      console.error('加载账目数据失败:', err)
    }
  },

  /**
   * 加载统计数据（月度概览 + 分类占比 + 月度趋势）
   * 三个查询并发执行，节省时间
   */
  loadStatistics: async () => {
    try {
      const { currentMonth } = get()
      const [monthlyOverview, categoryStats, monthlyTrends] = await Promise.all([
        db.getMonthlyOverview(currentMonth.year, currentMonth.month),
        db.getCategoryStats(currentMonth.year, currentMonth.month),
        db.getMonthlyTrends()
      ])
      set({ monthlyOverview, categoryStats, monthlyTrends })
    } catch (err) {
      console.error('加载统计数据失败:', err)
    }
  },

  /**
   * 一次性加载全部数据（首页用）
   * 三个加载并发执行，loading 状态包裹整个过程
   */
  loadAll: async () => {
    set({ loading: true })
    try {
      await Promise.all([
        get().loadCategories(),
        get().loadTransactions(),
        get().loadStatistics()
      ])
    } finally {
      set({ loading: false })
    }
  },

  // ====== 账目操作 Actions ======

  /**
   * 添加一条账目记录
   * 写入数据库后自动刷新列表和统计
   */
  addTransaction: async (input) => {
    await db.addTransaction({
      type: input.type,
      amount: input.amount,
      categoryL1: input.categoryL1,
      categoryL2: input.categoryL2,
      date: input.date,
      note: input.note
    })
    // 重新加载数据以反映新记录
    await get().loadTransactions()
    await get().loadStatistics()
  },

  /**
   * 删除一条账目记录
   * 从数据库删除后自动刷新
   */
  removeTransaction: async (id) => {
    await db.deleteTransaction(id)
    await get().loadTransactions()
    await get().loadStatistics()
  },

  /**
   * 切换到指定年月
   * 自动重新加载该月的账目和统计
   */
  setCurrentMonth: (year, month) => {
    set({ currentMonth: { year, month } })
    // 切换月份后自动刷新数据
    get().loadTransactions()
    get().loadStatistics()
  },

  // ====== 分类管理 Actions ======

  /**
   * 添加自定义分类
   * 写入数据库后自动刷新分类列表
   */
  addCategory: async (input) => {
    await db.addCategory({
      type: input.type,
      name: input.name,
      icon: input.icon,
      parentId: input.parentId,
      sortOrder: input.sortOrder
    })
    await get().loadCategories()
  },

  /**
   * 更新分类的名称和图标
   * 预置分类不允许修改（UI 层已经限制，这里是数据层保护）
   */
  updateCategory: async (id, name, icon) => {
    await db.updateCategory(id, name, icon)
    await get().loadCategories()
  },

  /**
   * 删除分类及其下的所有子分类
   * 如果是一级分类，数据库会级联删除其下的二级分类
   */
  removeCategory: async (id) => {
    await db.deleteCategory(id)
    await get().loadCategories()
  },

  /**
   * 重新加载分类（页面初始化时调用）
   */
  reloadCategories: async () => {
    await get().loadCategories()
  }
}))
