/**
 * 财务工具函数的单元测试
 */
import { describe, it, expect } from 'vitest'
import {
  calcBalance,
  formatAmount,
  calcPercentage,
  isValidAmount,
  sortCategories,
  percentsAddUpTo100,
} from './finance'

// ============================================================
// calcBalance 测试
// ============================================================
describe('calcBalance — 计算结余', () => {
  it('正常收支：收入 5000，支出 3200 → 结余 1800', () => {
    expect(calcBalance(5000, 3200)).toBe(1800)
  })

  it('只有收入没有支出：结余等于收入', () => {
    expect(calcBalance(1000, 0)).toBe(1000)
  })

  it('只有支出没有收入：结余为负数', () => {
    expect(calcBalance(0, 100)).toBe(-100)
  })

  it('收支相等：结余为 0', () => {
    expect(calcBalance(500, 500)).toBe(0)
  })
})

// ============================================================
// formatAmount 测试
// ============================================================
describe('formatAmount — 格式化金额', () => {
  it('整数金额', () => {
    expect(formatAmount(1000)).toBe('1,000.00')
  })

  it('带小数的金额', () => {
    expect(formatAmount(1234.5)).toBe('1,234.50')
  })

  it('大额金额千分位', () => {
    expect(formatAmount(12345678.9)).toBe('12,345,678.90')
  })

  it('0 元', () => {
    expect(formatAmount(0)).toBe('0.00')
  })
})

// ============================================================
// calcPercentage 测试
// ============================================================
describe('calcPercentage — 计算百分比', () => {
  it('amount=300, total=1000 → 30%', () => {
    expect(calcPercentage(300, 1000)).toBe(30)
  })

  it('amount=500, total=1000 → 50%', () => {
    expect(calcPercentage(500, 1000)).toBe(50)
  })

  it('total 为 0 时返回 0', () => {
    expect(calcPercentage(100, 0)).toBe(0)
  })

  it('精确到两位小数：amount=1, total=3 → 33.33%', () => {
    expect(calcPercentage(1, 3)).toBe(33.33)
  })
})

// ============================================================
// isValidAmount 测试
// ============================================================
describe('isValidAmount — 验证金额输入', () => {
  it('合法金额：100', () => {
    expect(isValidAmount('100')).toBe(true)
  })

  it('合法金额：99.99', () => {
    expect(isValidAmount('99.99')).toBe(true)
  })

  it('合法金额：0.01', () => {
    expect(isValidAmount('0.01')).toBe(true)
  })

  it('非法：负数', () => {
    expect(isValidAmount('-50')).toBe(false)
  })

  it('非法：0', () => {
    expect(isValidAmount('0')).toBe(false)
  })

  it('非法：超过两位小数', () => {
    expect(isValidAmount('10.999')).toBe(false)
  })

  it('非法：不是数字', () => {
    expect(isValidAmount('abc')).toBe(false)
  })
})

// ============================================================
// sortCategories 测试
// ============================================================
describe('sortCategories — 排序分类', () => {
  it('按 sortOrder 升序排列', () => {
    const list = [
      { sortOrder: 3, name: 'C' },
      { sortOrder: 1, name: 'A' },
      { sortOrder: 2, name: 'B' },
    ]
    const sorted = sortCategories(list)
    expect(sorted.map(c => c.name)).toEqual(['A', 'B', 'C'])
  })

  it('空数组返回空数组', () => {
    expect(sortCategories([])).toEqual([])
  })

  it('不修改原数组', () => {
    const list = [{ sortOrder: 2 }, { sortOrder: 1 }]
    const sorted = sortCategories(list)
    expect(sorted).not.toBe(list) // 不是同一个引用
    expect(list[0].sortOrder).toBe(2) // 原数组顺序不变
  })
})

// ============================================================
// percentsAddUpTo100 测试
// ============================================================
describe('percentsAddUpTo100 — 百分比总和验证', () => {
  it('刚好 100%', () => {
    expect(percentsAddUpTo100([30, 30, 40])).toBe(true)
  })

  it('浮点误差内接近 100%', () => {
    expect(percentsAddUpTo100([33.33, 33.33, 33.34])).toBe(true)
  })

  it('明显不是 100%', () => {
    expect(percentsAddUpTo100([50, 30])).toBe(false)
  })
})
