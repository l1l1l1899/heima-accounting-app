import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import initSqlJs, { Database as SqlJsDatabase, type SqlValue } from 'sql.js'

let db: SqlJsDatabase | null = null
let dbPath: string = ''

// ====== Schema ======

const SCHEMA_SQL = `
-- 分类表
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📦',
  parent_id INTEGER DEFAULT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_preset INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- 账目表
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
  amount REAL NOT NULL CHECK(amount > 0),
  category_l1 TEXT NOT NULL,
  category_l2 TEXT NOT NULL,
  date TEXT NOT NULL,
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category_l1 ON transactions(category_l1);
`

// ====== Migration ======

const MIGRATION_SQL = `
-- 为已有数据库添加 is_preset 列（如果列已存在会报错，try-catch 忽略）
ALTER TABLE categories ADD COLUMN is_preset INTEGER NOT NULL DEFAULT 0;
`

// ====== Seed Data (preset categories) ======

const PRESET_CATEGORIES_SQL = `
-- 支出 Level 1
INSERT OR IGNORE INTO categories (id, type, name, icon, parent_id, sort_order, is_preset) VALUES
(1,  'expense', '餐饮', '🍜', NULL, 1, 1),
(2,  'expense', '交通', '🚗', NULL, 2, 1),
(3,  'expense', '购物', '🛒', NULL, 3, 1),
(4,  'expense', '居住', '🏠', NULL, 4, 1),
(5,  'expense', '娱乐', '🎮', NULL, 5, 1),
(6,  'expense', '医疗', '🏥', NULL, 6, 1),
(7,  'expense', '教育', '📚', NULL, 7, 1),
(8,  'expense', '人情', '🎁', NULL, 8, 1),
(9,  'expense', '通讯', '📱', NULL, 9, 1),
(10, 'expense', '金融', '💰', NULL, 10, 1),
(11, 'expense', '其他', '📦', NULL, 11, 1);

-- 收入 Level 1
INSERT OR IGNORE INTO categories (id, type, name, icon, parent_id, sort_order, is_preset) VALUES
(20, 'income', '职业收入', '💼', NULL, 1, 1),
(21, 'income', '投资理财', '📈', NULL, 2, 1),
(22, 'income', '人情往来', '🎁', NULL, 3, 1),
(23, 'income', '其他收入', '📦', NULL, 4, 1);

-- Level 2: 餐饮
INSERT OR IGNORE INTO categories (id, type, name, icon, parent_id, sort_order, is_preset) VALUES
(101, 'expense', '早餐', '🥐', 1, 1, 1),
(102, 'expense', '午餐', '🍱', 1, 2, 1),
(103, 'expense', '晚餐', '🍲', 1, 3, 1),
(104, 'expense', '零食饮料', '🧋', 1, 4, 1),
(105, 'expense', '外卖', '🥡', 1, 5, 1),
(106, 'expense', '聚餐请客', '🍻', 1, 6, 1);

-- Level 2: 交通
INSERT OR IGNORE INTO categories (id, type, name, icon, parent_id, sort_order, is_preset) VALUES
(201, 'expense', '公交地铁', '🚇', 2, 1, 1),
(202, 'expense', '出租车/网约车', '🚕', 2, 2, 1),
(203, 'expense', '加油充电', '⛽', 2, 3, 1),
(204, 'expense', '停车费', '🅿️', 2, 4, 1),
(205, 'expense', '火车高铁', '🚄', 2, 5, 1),
(206, 'expense', '飞机', '✈️', 2, 6, 1),
(207, 'expense', '汽车保养维修', '🔧', 2, 7, 1);

-- Level 2: 购物
INSERT OR IGNORE INTO categories (id, type, name, icon, parent_id, sort_order, is_preset) VALUES
(301, 'expense', '日常用品', '🧴', 3, 1, 1),
(302, 'expense', '衣服鞋帽', '👗', 3, 2, 1),
(303, 'expense', '数码电子', '📱', 3, 3, 1),
(304, 'expense', '家居家具', '🛋️', 3, 4, 1),
(305, 'expense', '个护美妆', '💄', 3, 5, 1),
(306, 'expense', '文具书籍', '📖', 3, 6, 1);

-- Level 2: 居住
INSERT OR IGNORE INTO categories (id, type, name, icon, parent_id, sort_order, is_preset) VALUES
(401, 'expense', '房租', '🏘️', 4, 1, 1),
(402, 'expense', '房贷', '🏡', 4, 2, 1),
(403, 'expense', '水费', '💧', 4, 3, 1),
(404, 'expense', '电费', '⚡', 4, 4, 1),
(405, 'expense', '燃气费', '🔥', 4, 5, 1),
(406, 'expense', '物业费', '🏢', 4, 6, 1),
(407, 'expense', '维修装修', '🛠️', 4, 7, 1),
(408, 'expense', '网费', '🌐', 4, 8, 1);

-- Level 2: 娱乐
INSERT OR IGNORE INTO categories (id, type, name, icon, parent_id, sort_order, is_preset) VALUES
(501, 'expense', '电影', '🎬', 5, 1, 1),
(502, 'expense', '游戏', '🎮', 5, 2, 1),
(503, 'expense', '旅游度假', '🏖️', 5, 3, 1),
(504, 'expense', '运动健身', '🏋️', 5, 4, 1),
(505, 'expense', 'KTV酒吧', '🎤', 5, 5, 1),
(506, 'expense', '演出展览', '🎨', 5, 6, 1),
(507, 'expense', '会员订阅', '📺', 5, 7, 1);

-- Level 2: 医疗
INSERT OR IGNORE INTO categories (id, type, name, icon, parent_id, sort_order, is_preset) VALUES
(601, 'expense', '门诊挂号', '🏥', 6, 1, 1),
(602, 'expense', '药品', '💊', 6, 2, 1),
(603, 'expense', '住院', '🚑', 6, 3, 1),
(604, 'expense', '体检', '🩺', 6, 4, 1),
(605, 'expense', '牙科', '🦷', 6, 5, 1),
(606, 'expense', '眼镜', '👓', 6, 6, 1);

-- Level 2: 教育
INSERT OR IGNORE INTO categories (id, type, name, icon, parent_id, sort_order, is_preset) VALUES
(701, 'expense', '培训课程', '📚', 7, 1, 1),
(702, 'expense', '考试报名', '📝', 7, 2, 1),
(703, 'expense', '教材资料', '📖', 7, 3, 1),
(704, 'expense', '子女教育', '👶', 7, 4, 1);

-- Level 2: 人情
INSERT OR IGNORE INTO categories (id, type, name, icon, parent_id, sort_order, is_preset) VALUES
(801, 'expense', '红包礼金', '🧧', 8, 1, 1),
(802, 'expense', '孝敬父母', '👴', 8, 2, 1),
(803, 'expense', '慈善捐款', '💝', 8, 3, 1),
(804, 'expense', '请客送礼', '🎁', 8, 4, 1);

-- Level 2: 通讯
INSERT OR IGNORE INTO categories (id, type, name, icon, parent_id, sort_order, is_preset) VALUES
(901, 'expense', '手机话费', '📱', 9, 1, 1),
(902, 'expense', '快递物流', '📦', 9, 2, 1);

-- Level 2: 金融
INSERT OR IGNORE INTO categories (id, type, name, icon, parent_id, sort_order, is_preset) VALUES
(1001, 'expense', '手续费', '💳', 10, 1, 1),
(1002, 'expense', '利息支出', '🏦', 10, 2, 1),
(1003, 'expense', '保险缴费', '🛡️', 10, 3, 1);

-- Level 2: 其他
INSERT OR IGNORE INTO categories (id, type, name, icon, parent_id, sort_order, is_preset) VALUES
(1101, 'expense', '其他支出', '📦', 11, 1, 1);

-- Level 2: 职业收入
INSERT OR IGNORE INTO categories (id, type, name, icon, parent_id, sort_order, is_preset) VALUES
(2001, 'income', '工资', '💰', 20, 1, 1),
(2002, 'income', '奖金', '🏆', 20, 2, 1),
(2003, 'income', '兼职', '💼', 20, 3, 1),
(2004, 'income', '加班补贴', '⏰', 20, 4, 1);

-- Level 2: 投资理财
INSERT OR IGNORE INTO categories (id, type, name, icon, parent_id, sort_order, is_preset) VALUES
(2101, 'income', '股票基金收益', '📈', 21, 1, 1),
(2102, 'income', '利息收入', '🏦', 21, 2, 1),
(2103, 'income', '房租收入', '🏘️', 21, 3, 1),
(2104, 'income', '分红', '💎', 21, 4, 1);

-- Level 2: 人情往来
INSERT OR IGNORE INTO categories (id, type, name, icon, parent_id, sort_order, is_preset) VALUES
(2201, 'income', '红包收入', '🧧', 22, 1, 1),
(2202, 'income', '礼金收入', '🎁', 22, 2, 1),
(2203, 'income', '报销退款', '💵', 22, 3, 1);

-- Level 2: 其他收入
INSERT OR IGNORE INTO categories (id, type, name, icon, parent_id, sort_order, is_preset) VALUES
(2301, 'income', '其他收入', '📦', 23, 1, 1);

-- 确保所有预置分类的 is_preset = 1（修复已有数据库）
UPDATE categories SET is_preset = 1 WHERE id <= 2301;
`

// ====== Database Manager ======

export async function initDatabase(): Promise<void> {
  const SQL = await initSqlJs()

  // Ensure userData directory exists
  const userDataPath = app.getPath('userData')
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true })
  }

  dbPath = join(userDataPath, 'hema-jizhang.db')

  // Load existing database or create new one
  if (existsSync(dbPath)) {
    const buffer = readFileSync(dbPath)
    db = new SQL.Database(buffer)
  } else {
    db = new SQL.Database()
  }

  // Run schema
  db.run(SCHEMA_SQL)

  // Run migration (ignore error if column already exists)
  try {
    db.run(MIGRATION_SQL)
  } catch {
    // is_preset column already exists, that's fine
  }

  // Insert preset categories
  db.run(PRESET_CATEGORIES_SQL)

  // Save to disk
  saveToDisk()
}

function saveToDisk(): void {
  if (!db || !dbPath) return
  const data = db.export()
  const buffer = Buffer.from(data)
  writeFileSync(dbPath, buffer)
}

function getDb(): SqlJsDatabase {
  if (!db) throw new Error('Database not initialized')
  return db
}

// ====== Query APIs ======

/** 执行查询，返回多行结果 */
export function queryAll(sql: string, params: unknown[] = []): unknown[] {
  const db = getDb()
  const stmt = db.prepare(sql)
  stmt.bind(params as SqlValue[])
  const results: unknown[] = []
  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()
  return results
}

/** 执行查询，返回单行结果 */
export function queryOne(sql: string, params: unknown[] = []): unknown | null {
  const results = queryAll(sql, params)
  return results.length > 0 ? results[0] : null
}

/** 执行写操作（INSERT/UPDATE/DELETE） */
export function execute(sql: string, params: unknown[] = []): { changes: number; lastInsertId: number } {
  const db = getDb()
  db.run(sql, params as SqlValue[])
  saveToDisk()
  return {
    changes: db.getRowsModified(),
    lastInsertId: 1 // sql.js doesn't provide lastInsertRowid reliably, handle in caller
  }
}

/** 获取 lastInsertRowId */
export function getLastInsertId(): number {
  const results = queryAll('SELECT last_insert_rowid() as id')
  return (results[0] as { id: number })?.id || 0
}

// ====== Category CRUD ======

/** 添加用户自定义分类 */
export function addCategory(params: {
  type: string
  name: string
  icon: string
  parentId: number | null
  sortOrder: number
}): { changes: number; lastInsertId: number } {
  const db = getDb()
  db.run(
    `INSERT INTO categories (type, name, icon, parent_id, sort_order, is_preset)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [params.type, params.name, params.icon, params.parentId, params.sortOrder]
  )
  saveToDisk()
  const id = queryAll('SELECT last_insert_rowid() as id')
  return {
    changes: db.getRowsModified(),
    lastInsertId: (id[0] as { id: number })?.id || 0
  }
}

/** 更新分类名称和图标（仅限用户自建分类） */
export function updateCategory(id: number, name: string, icon: string): { changes: number } {
  const db = getDb()
  db.run(
    `UPDATE categories SET name = ?, icon = ? WHERE id = ? AND is_preset = 0`,
    [name, icon, id]
  )
  saveToDisk()
  return { changes: db.getRowsModified() }
}

/** 删除分类（仅限用户自建分类，一级分类删除时级联删除二级分类） */
export function deleteCategory(id: number): { changes: number } {
  const db = getDb()
  // 先删除该分类下的二级分类
  db.run('DELETE FROM categories WHERE parent_id = ? AND is_preset = 0', [id])
  // 再删除该分类本身
  db.run('DELETE FROM categories WHERE id = ? AND is_preset = 0', [id])
  saveToDisk()
  return { changes: db.getRowsModified() }
}

/** 关闭数据库 */
export function closeDatabase(): void {
  if (db) {
    saveToDisk()
    db.close()
    db = null
  }
}
