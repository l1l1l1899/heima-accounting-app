/**
 * 分类相关的纯函数（从 database/api.ts 提取，不依赖 Electron）
 */
import type { Category, TransactionType, MonthlyTrend } from '../types'

// ============================================================
// 数据映射
// ============================================================

/**
 * 把数据库返回的 snake_case 字段映射为 TypeScript 用的 camelCase
 * 这是 api.ts 中 mapCategory 的纯函数版本
 */
export function mapCategory(row: Record<string, unknown>): Category {
  return {
    id: row.id as number,
    type: row.type as TransactionType,
    name: row.name as string,
    parentId: (row.parent_id ?? null) as number | null,
    icon: row.icon as string,
    sortOrder: row.sort_order as number,
    isPreset: (row.is_preset as number) === 1,
  }
}

// ============================================================
// SQL 查询构建
// ============================================================

/** 查询账目的过滤条件 */
export interface TransactionFilters {
  type?: 'expense' | 'income'
  startDate?: string
  endDate?: string
  categoryL1?: string
}

/**
 * 根据过滤条件构建 SQL WHERE 子句
 * 返回 { conditions, params } 用于拼接 SQL
 */
export function buildTransactionFilters(filters: TransactionFilters): {
  conditions: string[]
  params: unknown[]
} {
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters.type) {
    conditions.push('type = ?')
    params.push(filters.type)
  }
  if (filters.startDate) {
    conditions.push('date >= ?')
    params.push(filters.startDate)
  }
  if (filters.endDate) {
    conditions.push('date <= ?')
    params.push(filters.endDate)
  }
  if (filters.categoryL1) {
    conditions.push('category_l1 = ?')
    params.push(filters.categoryL1)
  }

  return { conditions, params }
}

/**
 * 根据过滤条件生成完整的查询 SQL
 */
export function buildTransactionQuery(
  filters: TransactionFilters,
  limit?: number,
  offset?: number
): { sql: string; params: unknown[] } {
  const { conditions, params } = buildTransactionFilters(filters)

  let sql = 'SELECT * FROM transactions'
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ')
  }
  sql += ' ORDER BY date DESC, id DESC'

  if (limit !== undefined) {
    sql += ' LIMIT ?'
    params.push(limit)
  }
  if (offset !== undefined) {
    sql += ' OFFSET ?'
    params.push(offset)
  }

  return { sql, params }
}

// ============================================================
// 日期工具
// ============================================================

/**
 * 生成月份前缀，如 (2024, 6) → "2024-06"
 */
export function getMonthPrefix(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

// ============================================================
// 趋势数据合并
// ============================================================

/** 数据库中查询到的原始月度行 */
export interface RawMonthlyRow {
  year: string
  month: string
  type: string
  total: number
}

/**
 * 将数据库查询结果（收入/支出分两行）合并为 MonthlyTrend 列表
 * 这是 getMonthlyTrends 的核心合并逻辑
 */
export function mergeMonthlyTrends(rows: RawMonthlyRow[]): MonthlyTrend[] {
  const trendMap = new Map<string, MonthlyTrend>()

  for (const row of rows) {
    const key = `${row.year}-${row.month}`
    if (!trendMap.has(key)) {
      trendMap.set(key, {
        year: parseInt(row.year),
        month: parseInt(row.month),
        income: 0,
        expense: 0,
        label: key,
      })
    }
    const entry = trendMap.get(key)!
    if (row.type === 'income') {
      entry.income = row.total
    } else {
      entry.expense = row.total
    }
  }

  return Array.from(trendMap.values())
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(-12)
}
