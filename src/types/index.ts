// ====== 账目记录 ======

/** 交易类型 */
export type TransactionType = 'expense' | 'income'

/** 一条账目记录 */
export interface Transaction {
  id: number
  type: TransactionType
  amount: number          // 金额（元），保留两位小数
  categoryL1: string      // 一级分类
  categoryL2: string      // 二级分类
  date: string            // 日期，格式 YYYY-MM-DD
  note: string            // 备注
  createdAt: string       // 创建时间
  updatedAt: string       // 更新时间
}

/** 创建账目时提交的数据（不含自动生成字段） */
export interface CreateTransactionInput {
  type: TransactionType
  amount: number
  categoryL1: string
  categoryL2: string
  date: string
  note?: string
}

// ====== 分类 ======

/** 一个分类项 */
export interface Category {
  id: number
  type: TransactionType
  name: string            // 分类名称
  parentId: number | null // 父分类ID（null=一级分类）
  icon: string            // 图标 emoji
  sortOrder: number       // 排序顺序
  isPreset: boolean       // 是否系统预置（预置分类不可删除/修改名称）
}

/** 新增分类时提交的数据 */
export interface CreateCategoryInput {
  type: TransactionType
  name: string
  icon: string
  parentId: number | null
  sortOrder: number
}

/** 修改分类时提交的数据 */
export interface UpdateCategoryInput {
  id: number
  name: string
  icon: string
}

// ====== 统计 ======

/** 月度统计概览 */
export interface MonthlyOverview {
  totalIncome: number
  totalExpense: number
  balance: number
  year: number
  month: number
}

/** 分类统计（饼图用） */
export interface CategoryStat {
  categoryL1: string
  icon: string
  amount: number
  percentage: number
}

/** 月度趋势数据点（折线图用） */
export interface MonthlyTrend {
  year: number
  month: number
  income: number
  expense: number
  label: string  // 如 "2024-01"
}
