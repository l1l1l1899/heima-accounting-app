/**
 * 分类/数据库工具的单元测试
 */
import { describe, it, expect } from 'vitest'
import {
  mapCategory,
  buildTransactionFilters,
  buildTransactionQuery,
  getMonthPrefix,
  mergeMonthlyTrends,
} from './category'
import type { RawMonthlyRow } from './category'

// ============================================================
// mapCategory 测试
// ============================================================
describe('mapCategory — 数据库字段映射', () => {
  it('正常映射：snake_case → camelCase', () => {
    const row = {
      id: 1,
      type: 'expense',
      name: '餐饮',
      parent_id: null,
      icon: '🍜',
      sort_order: 1,
      is_preset: 1,
    }
    const result = mapCategory(row)
    expect(result).toEqual({
      id: 1,
      type: 'expense',
      name: '餐饮',
      parentId: null,
      icon: '🍜',
      sortOrder: 1,
      isPreset: true,
    })
  })

  it('parent_id 为数字时正确转为 parentId', () => {
    const row = {
      id: 5,
      type: 'expense',
      name: '早餐',
      parent_id: 1,
      icon: '☕',
      sort_order: 2,
      is_preset: 1,
    }
    const result = mapCategory(row)
    expect(result.parentId).toBe(1)
  })

  it('is_preset=0 时 isPreset=false', () => {
    const row = {
      id: 100,
      type: 'income',
      name: '自定义收入',
      parent_id: null,
      icon: '💰',
      sort_order: 10,
      is_preset: 0,
    }
    const result = mapCategory(row)
    expect(result.isPreset).toBe(false)
  })

  it('parent_id 为 undefined 时 parentId 为 null', () => {
    const row = {
      id: 1,
      type: 'expense',
      name: '测试',
      parent_id: undefined,
      icon: '📦',
      sort_order: 1,
      is_preset: 0,
    }
    const result = mapCategory(row)
    expect(result.parentId).toBeNull()
  })
})

// ============================================================
// buildTransactionFilters 测试
// ============================================================
describe('buildTransactionFilters — 构建 SQL 过滤条件', () => {
  it('无过滤条件时返回空', () => {
    const { conditions, params } = buildTransactionFilters({})
    expect(conditions).toHaveLength(0)
    expect(params).toHaveLength(0)
  })

  it('只有 type 过滤', () => {
    const { conditions, params } = buildTransactionFilters({ type: 'expense' })
    expect(conditions).toContain('type = ?')
    expect(params).toEqual(['expense'])
  })

  it('多个过滤条件', () => {
    const { conditions, params } = buildTransactionFilters({
      type: 'expense',
      startDate: '2024-06-01',
      endDate: '2024-06-30',
      categoryL1: '餐饮',
    })
    expect(conditions).toHaveLength(4)
    expect(params).toEqual(['expense', '2024-06-01', '2024-06-30', '餐饮'])
  })

  it('只有日期范围', () => {
    const { conditions, params } = buildTransactionFilters({
      startDate: '2024-01-01',
      endDate: '2024-12-31',
    })
    expect(conditions).toHaveLength(2)
    expect(params).toEqual(['2024-01-01', '2024-12-31'])
  })
})

// ============================================================
// buildTransactionQuery 测试
// ============================================================
describe('buildTransactionQuery — 生成完整 SQL', () => {
  it('无过滤条件：生成基础 SQL', () => {
    const { sql, params } = buildTransactionQuery({})
    expect(sql).toContain('SELECT * FROM transactions')
    expect(sql).toContain('ORDER BY date DESC, id DESC')
    expect(sql).not.toContain('WHERE')
  })

  it('有过滤条件：包含 WHERE', () => {
    const { sql, params } = buildTransactionQuery({ type: 'income' })
    expect(sql).toContain('WHERE type = ?')
    expect(params).toEqual(['income'])
  })

  it('带 LIMIT 和 OFFSET', () => {
    const { sql, params } = buildTransactionQuery({}, 20, 10)
    expect(sql).toContain('LIMIT ?')
    expect(sql).toContain('OFFSET ?')
    expect(params).toEqual([20, 10])
  })

  it('完整过滤 + 分页', () => {
    const { sql, params } = buildTransactionQuery(
      { type: 'expense', startDate: '2024-06-01' },
      50,
      0
    )
    expect(sql).toContain('WHERE')
    expect(sql).toContain('LIMIT ?')
    expect(sql).toContain('OFFSET ?')
    expect(params).toEqual(['expense', '2024-06-01', 50, 0])
  })
})

// ============================================================
// getMonthPrefix 测试
// ============================================================
describe('getMonthPrefix — 月份前缀', () => {
  it('个位数月份补零：6月 → "2024-06"', () => {
    expect(getMonthPrefix(2024, 6)).toBe('2024-06')
  })

  it('双位数月份不补零：12月 → "2024-12"', () => {
    expect(getMonthPrefix(2024, 12)).toBe('2024-12')
  })

  it('1月：补零 → "2024-01"', () => {
    expect(getMonthPrefix(2024, 1)).toBe('2024-01')
  })
})

// ============================================================
// mergeMonthlyTrends 测试
// ============================================================
describe('mergeMonthlyTrends — 月度趋势合并', () => {
  it('收入和支出分开的行合并为一条', () => {
    const rows: RawMonthlyRow[] = [
      { year: '2024', month: '06', type: 'income', total: 10000 },
      { year: '2024', month: '06', type: 'expense', total: 6000 },
    ]
    const result = mergeMonthlyTrends(rows)
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      year: 2024,
      month: 6,
      income: 10000,
      expense: 6000,
      label: '2024-06',
    })
  })

  it('某个月只有收入没有支出', () => {
    const rows: RawMonthlyRow[] = [
      { year: '2024', month: '07', type: 'income', total: 5000 },
    ]
    const result = mergeMonthlyTrends(rows)
    expect(result[0]).toMatchObject({
      income: 5000,
      expense: 0,
    })
  })

  it('某个月只有支出没有收入', () => {
    const rows: RawMonthlyRow[] = [
      { year: '2024', month: '08', type: 'expense', total: 3000 },
    ]
    const result = mergeMonthlyTrends(rows)
    expect(result[0]).toMatchObject({
      income: 0,
      expense: 3000,
    })
  })

  it('多个月按 label 排序', () => {
    const rows: RawMonthlyRow[] = [
      { year: '2024', month: '03', type: 'income', total: 1000 },
      { year: '2024', month: '01', type: 'income', total: 1000 },
      { year: '2024', month: '02', type: 'income', total: 1000 },
    ]
    const result = mergeMonthlyTrends(rows)
    expect(result.map(r => r.label)).toEqual([
      '2024-01',
      '2024-02',
      '2024-03',
    ])
  })

  it('超过 12 个月的只保留最近 12 条', () => {
    const rows: RawMonthlyRow[] = []
    for (let m = 1; m <= 15; m++) {
      rows.push({
        year: '2024',
        month: String(m).padStart(2, '0'),
        type: 'income',
        total: 1000,
      })
    }
    const result = mergeMonthlyTrends(rows)
    expect(result).toHaveLength(12)
    // 只保留最近的 12 条（去掉前面 3 条）
    expect(result[0].month).toBe(4)
    expect(result[11].month).toBe(15) // 注意：这里是测试数据，实际场景 month 不会超过 12
  })

  it('空数组返回空数组', () => {
    expect(mergeMonthlyTrends([])).toEqual([])
  })
})
