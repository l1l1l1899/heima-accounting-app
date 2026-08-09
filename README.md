# 🐴 黑马记账

> 一款免费、离线、安全的个人桌面记账应用，支持 Windows 和 Mac。

---

## ✨ 功能概览

| 功能 | 说明 |
|------|------|
| 📝 **记支出 / 记收入** | 记录金额、日期、分类、备注 |
| 📂 **二级分类体系** | 11 个支出一级分类 + 4 个收入一级分类，每个一级下包含多个二级小类 |
| 🔧 **自定义分类** | 自由添加、修改、删除自己的分类（系统预置分类锁定保护） |
| 📊 **统计图表** | 月度收支总览、分类占比饼图、近 12 个月趋势折线图 |
| 🔍 **账单明细** | 按日期排列的账单列表，支持分类和时间筛选 |
| 📤 **数据导出** | 导出为 CSV 文件，可用 Excel 打开 |
| 📥 **数据导入** | 从 CSV 文件恢复数据 |
| 🔒 **隐私安全** | 全部数据存储在本地，不上传任何服务器 |

---

## 🖥️ 界面截图

> 应用包含 5 个页面：**首页仪表盘**、**记账**、**统计图表**、**分类管理**、**设置**

---

## 🛠️ 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 桌面外壳 | Electron | 把网页打包成 Windows / Mac 桌面应用 |
| 界面框架 | React 18 + TypeScript | 类型安全的 UI 开发 |
| UI 组件库 | Ant Design 5 | 提供按钮、表格、表单等组件 |
| 图表库 | Recharts | 生成饼图、折线图 |
| 状态管理 | Zustand | 管理应用数据状态 |
| 本地数据库 | SQLite (sql.js) | WebAssembly 版，无需额外安装 |
| 打包工具 | electron-builder | 打包成 .exe（Win）和 .dmg（Mac） |

---

## 📁 项目结构

```
黑马记账 APP/
├── CLAUDE.md                    # 产品文档与开发说明
├── README.md                    # 本文件
├── package.json                 # 依赖配置
├── electron/                    # Electron 主进程
│   ├── main.ts                  # 窗口管理、IPC 通信
│   ├── database.ts              # 数据库初始化与操作
│   └── preload.ts               # 安全的渲染进程桥接
├── src/                         # 渲染进程（界面）
│   ├── App.tsx                  # 应用入口与路由
│   ├── pages/                   # 页面
│   │   ├── HomePage.tsx         # 首页仪表盘
│   │   ├── RecordPage.tsx       # 记账页面
│   │   ├── StatisticsPage.tsx   # 统计页面
│   │   ├── CategoryPage.tsx     # 分类管理页面
│   │   └── SettingsPage.tsx     # 设置页面
│   ├── components/              # 可复用组件
│   ├── stores/                  # Zustand 状态管理
│   ├── database/                # 数据库 API 封装
│   └── types/                   # TypeScript 类型定义
└── resources/                   # 应用图标等资源
```

---

## 🚀 本地运行

### 环境要求

- [Node.js](https://nodejs.org/) 18 或以上版本
- Git（用于克隆仓库）

### 步骤

```bash
# 1. 克隆项目
git clone git@gitee.com:javacaoyu/itheima-accounting-app.git

# 2. 进入目录
cd itheima-accounting-app

# 3. 安装依赖
npm install

# 4. 启动开发模式
npm run dev
```

启动后会自动弹出 Electron 窗口，开发服务器运行在 `http://localhost:5173`。

### 打包为安装文件

```bash
# 打包 Windows 版本（生成 .exe 安装程序）
npm run package:win

# 打包 Mac 版本（生成 .dmg 安装程序）
npm run package:mac
```

---

## 📊 预置分类

### 支出（11 大类）

🍜 餐饮 | 🚗 交通 | 🛒 购物 | 🏠 居住 | 🎮 娱乐 | 🏥 医疗 | 📚 教育 | 🎁 人情 | 📱 通讯 | 💰 金融 | 📦 其他

### 收入（4 大类）

💼 职业收入 | 📈 投资理财 | 🎁 人情往来 | 📦 其他收入

---

## ⚠️ 注意事项

- 数据库文件存放在用户目录下（`~/.hema-jizhang/database.sqlite`），请勿手动删除
- 导出数据建议定期备份，以防误删
- 系统预置分类不可删除或改名，用户可自由添加自定义分类

---

## 📄 开源协议

MIT License

---

**🐴 黑马记账 —— 让每一笔账目都清清楚楚！**
