/**
 * 数据库 API 层
 * 提供渲染进程中调用的高阶数据库操作函数
 */
import type {
  Transaction,
  TransactionType,
  CreateTransactionInput,
  Category,
  MonthlyOverview,
  CategoryStat,
  MonthlyTrend
} from '../types'

const api = window.electronAPI

// ====== Categories ======

/** 把数据库返回的 snake_case 字段映射为 ts 用的 camelCase */
function mapCategory(row: unknown): Category {
  const r = row as Record<string, unknown>
  return {
    id: r.id as number,
    type: r.type as TransactionType,
    name: r.name as string,
    parentId: (r.parent_id ?? null) as number | null,
    icon: r.icon as string,
    sortOrder: r.sort_order as number,
    isPreset: (r.is_preset as number) === 1
  }
}

/** 把数据库返回的 transactions 行映射为 camelCase 字段 */
function mapTransaction(row: unknown): Transaction {
  const r = row as Record<string, unknown>
  return {
    id: r.id as number,
    type: r.type as TransactionType,
    amount: r.amount as number,
    categoryL1: r.category_l1 as string,
    categoryL2: r.category_l2 as string,
    date: r.date as string,
    note: r.note as string,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string
  }
}

/** 获取所有分类 */
export async function getCategories(type?: 'expense' | 'income'): Promise<Category[]> {
  let sql = 'SELECT * FROM categories'
  const params: unknown[] = []
  if (type) {
    sql += ' WHERE type = ?'
    params.push(type)
  }
  sql += ' ORDER BY parent_id NULLS FIRST, sort_order'
  // NULLS FIRST 确保一级分类（parent_id 为 NULL）排在二级分类前面
  const rows = await api.db.queryAll(sql, params)
  return rows.map(mapCategory)
}

/** 获取一级分类 */
export async function getLevel1Categories(type?: 'expense' | 'income'): Promise<Category[]> {
  // 一级分类的 parent_id 为 NULL
  let sql = 'SELECT * FROM categories WHERE parent_id IS NULL'
  const params: unknown[] = []
  if (type) {
    sql += ' AND type = ?'
    params.push(type)
  }
  sql += ' ORDER BY sort_order'
  const rows = await api.db.queryAll(sql, params)
  return rows.map(mapCategory)
}

/** 获取某一级分类下的二级分类 */
export async function getLevel2Categories(parentId: number): Promise<Category[]> {
  const rows = await api.db.queryAll(
    'SELECT * FROM categories WHERE parent_id = ? ORDER BY sort_order',
    [parentId]
  )
  return rows.map(mapCategory)
}

// ====== Category Management ======

/** 添加用户自定义分类 */
export async function addCategory(input: {
  type: TransactionType
  name: string
  icon: string
  parentId: number | null
  sortOrder: number
}): Promise<number> {
  // 先通过主进程的预编译语句插入，获得影响行数
  const result = await api.category.add({
    type: input.type,
    name: input.name,
    icon: input.icon,
    parentId: input.parentId,
    sortOrder: input.sortOrder
  })
  return result.lastInsertId
}

/** 更新分类名称和图标 */
export async function updateCategory(id: number, name: string, icon: string): Promise<number> {
  // 通过主进程更新数据库，返回受影响的行数
  const result = await api.category.update(id, name, icon)
  return result.changes
}

/** 删除分类 */
export async function deleteCategory(id: number): Promise<number> {
  // 通过主进程删除数据库记录，返回受影响的行数
  const result = await api.category.delete(id)
  return result.changes
}

// ====== Transactions ======

/** 添加一条账目 */
export async function addTransaction(input: CreateTransactionInput): Promise<number> {
  // 拼写 INSERT 语句，使用参数化查询防止 SQL 注入
  const result = await api.db.execute(
    `INSERT INTO transactions (type, amount, category_l1, category_l2, date, note)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [input.type, input.amount, input.categoryL1, input.categoryL2, input.date, input.note || '']
  )
  // sql.js 的 execute 返回的 lastInsertId 可能不准，通过 last_insert_rowid() 二次确认
  const row = await api.db.queryOne('SELECT last_insert_rowid() as id')
  return (row as { id: number })?.id || 0
}

/** 更新一条账目 */
export async function updateTransaction(id: number, input: CreateTransactionInput): Promise<void> {
  await api.db.execute(
    `UPDATE transactions
     SET type = ?, amount = ?, category_l1 = ?, category_l2 = ?, date = ?, note = ?,
         updated_at = datetime('now', 'localtime')
     WHERE id = ?`,
    [input.type, input.amount, input.categoryL1, input.categoryL2, input.date, input.note || '', id]
  )
}

/** 删除一条账目 */
export async function deleteTransaction(id: number): Promise<void> {
  await api.db.execute('DELETE FROM transactions WHERE id = ?', [id])
}

/** 获取账目列表 */
export async function getTransactions(filters?: {
  type?: 'expense' | 'income'
  startDate?: string
  endDate?: string
  categoryL1?: string
  limit?: number
  offset?: number
}): Promise<Transaction[]> {
  // 动态构建 WHERE 条件 —— 只有传了的筛选条件才拼上
  const conditions: string[] = []
  const params: unknown[] = []

  if (filters?.type) {
    conditions.push('type = ?')
    params.push(filters.type)
  }
  if (filters?.startDate) {
    conditions.push('date >= ?')
    params.push(filters.startDate)
  }
  if (filters?.endDate) {
    conditions.push('date <= ?')
    params.push(filters.endDate)
  }
  if (filters?.categoryL1) {
    conditions.push('category_l1 = ?')
    params.push(filters.categoryL1)
  }

  // 拼接 SQL：基础查询 + 条件 + 排序 + 分页
  let sql = 'SELECT * FROM transactions'
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ')
  }
  sql += ' ORDER BY date DESC, id DESC'

  // 分页支持
  if (filters?.limit) {
    sql += ' LIMIT ?'
    params.push(filters.limit)
  }
  if (filters?.offset) {
    sql += ' OFFSET ?'
    params.push(filters.offset)
  }

  const rows = await api.db.queryAll(sql, params)
  return rows.map(mapTransaction)
}

// ====== Statistics ======

/** 获取月度概览 */
export async function getMonthlyOverview(year: number, month: number): Promise<MonthlyOverview> {
  // 构造日期前缀，如 "2026-06"，用 LIKE 匹配该月所有日期
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  // 查询该月收入总和（COALESCE 保证没有数据时返回 0 而不是 NULL）
  const incomeRow = (await api.db.queryOne(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
     WHERE type = 'income' AND date LIKE ?`,
    [`${prefix}%`]
  )) as { total: number }
  // 查询该月支出总和
  const expenseRow = (await api.db.queryOne(
    `SELECT COALESCE(SUM(amount), 0) as total FROM transactions
     WHERE type = 'expense' AND date LIKE ?`,
    [`${prefix}%`]
  )) as { total: number }

  return {
    totalIncome: incomeRow.total,
    totalExpense: expenseRow.total,
    balance: incomeRow.total - expenseRow.total,  // 结余 = 收入 - 支出
    year,
    month
  }
}

/** 获取支出分类统计（饼图数据） */
export async function getCategoryStats(year: number, month: number): Promise<CategoryStat[]> {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  // LEFT JOIN 关联分类表取图标；按一级分类名分组汇总金额
  const rows = (await api.db.queryAll(
    `SELECT t.category_l1, c.icon, SUM(t.amount) as amount
     FROM transactions t
     LEFT JOIN categories c ON c.name = t.category_l1 AND c.parent_id IS NULL
     WHERE t.type = 'expense' AND t.date LIKE ?
     GROUP BY t.category_l1
     ORDER BY amount DESC`,
    [`${prefix}%`]
  )) as { category_l1: string; icon: string; amount: number }[]

  // 计算该月总支出，用于算百分比
  const totalExpense = rows.reduce((sum, r) => sum + r.amount, 0)

  return rows.map(r => ({
    categoryL1: r.category_l1,
    icon: r.icon || '📦',
    amount: r.amount,
    // 百分比保留两位小数（乘10000取整再除100 = 保留两位）
    percentage: totalExpense > 0 ? Math.round((r.amount / totalExpense) * 10000) / 100 : 0
  }))
}

/** 获取最近12个月的收支趋势 */
export async function getMonthlyTrends(): Promise<MonthlyTrend[]> {
  // 按年-月-类型分组查总和，LIMIT 24 = 最多取24条（12个月 × 收入/支出各一条）
  const rows = (await api.db.queryAll(
    `SELECT
       strftime('%Y', date) as year,
       strftime('%m', date) as month,
       type,
       SUM(amount) as total
     FROM transactions
     GROUP BY year, month, type
     ORDER BY year DESC, month DESC
     LIMIT 24`
  )) as { year: string; month: string; type: string; total: number }[]

  // 把收入和支出合并成同一条数据点：同一个月 → 一个 { income, expense } 对象
  const trendMap = new Map<string, MonthlyTrend>()
  for (const row of rows) {
    const key = `${row.year}-${row.month}`
    if (!trendMap.has(key)) {
      trendMap.set(key, {
        year: parseInt(row.year),
        month: parseInt(row.month),
        income: 0,
        expense: 0,
        label: key
      })
    }
    const entry = trendMap.get(key)!
    if (row.type === 'income') entry.income = row.total
    else entry.expense = row.total
  }

  // 按日期排序后截取最近12个月
  return Array.from(trendMap.values())
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(-12)
}

/** 直接执行 SQL（用于批量操作如清空数据） */
export async function executeSql(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
  return await api.db.execute(sql, params)
}
