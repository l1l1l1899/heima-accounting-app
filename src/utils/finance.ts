/**
 * 记账相关的纯计算函数（不依赖 DOM、数据库、Electron）
 * 这些函数非常适合写单元测试！
 */

/**
 * 计算结余 = 收入 - 支出
 */
export function calcBalance(income: number, expense: number): number {
  return income - expense
}

/**
 * 格式化金额为人民币显示
 * 例：1234.5 → "1,234.50"
 */
export function formatAmount(amount: number): string {
  const fixed = amount.toFixed(2)
  const [intPart, decPart] = fixed.split('.')
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${formatted}.${decPart}`
}

/**
 * 计算百分比（保留两位小数）
 * 例：amount=300, total=1000 → 30.0
 */
export function calcPercentage(amount: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((amount / total) * 10000) / 100
}

/**
 * 验证金额输入是否合法
 * - 必须是正数
 * - 最多两位小数
 * - 最大不超过 99999999.99
 */
export function isValidAmount(value: string): boolean {
  const num = parseFloat(value)
  if (isNaN(num) || num <= 0 || num > 99999999.99) return false
  // 检查小数位数
  const parts = value.split('.')
  if (parts.length === 2 && parts[1].length > 2) return false
  return true
}

/**
 * 将分类列表按 sortOrder 排序
 */
export function sortCategories<T extends { sortOrder: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder)
}

/**
 * 计算一组百分比是否加起来等于 100（用于饼图验证）
 */
export function percentsAddUpTo100(percents: number[]): boolean {
  const sum = percents.reduce((a, b) => a + b, 0)
  return Math.abs(sum - 100) < 1 // 允许 ±1 的浮点误差
}
