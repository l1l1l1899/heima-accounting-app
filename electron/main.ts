/**
 * Electron 主进程 —— 桌面应用的"管家"
 *
 * 主进程负责所有系统级操作（渲染进程不能直接做）：
 * 1. 创建和管理桌面窗口
 * 2. 处理 IPC 通信（渲染进程通过 IPC 请求主进程帮忙做事）
 * 3. 初始化 SQLite 数据库
 * 4. 处理文件读写（保存/打开对话框）
 *
 * 类比：就像餐厅的前台和后厨——渲染进程是前台的菜单（用户看到的东西），
 * 主进程是后厨（真正干活的地方），两者通过 IPC（传菜窗口）通信
 */
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { writeFileSync, readFileSync } from 'fs'
import { initDatabase, queryAll, queryOne, execute, addCategory, updateCategory, deleteCategory, closeDatabase } from './database'

/** 主窗口的引用（全局单例） */
let mainWindow: BrowserWindow | null = null

/**
 * 创建应用主窗口
 *
 * dev 模式和 production 模式的区别：
 * - dev 模式：加载 localhost 开发服务器（支持热更新）
 * - production 模式：加载打包后的 HTML 文件
 */
function createWindow(): void {
  // 判断是否已打包（app.isPackaged = true 表示是安装后的正式版）
  const isDev = !app.isPackaged

  // 创建浏览器窗口（Electron 窗口本质上就是 Chromium 浏览器窗口）
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,     // 最小宽度，防止窗口太小布局错乱
    minHeight: 600,
    title: '黑马记账',
    show: false,       // 先不显示，等 ready-to-show 事件再显示（避免白屏闪烁）
    webPreferences: {
      // preload 脚本：在渲染进程和主进程之间建一座安全桥梁
      preload: join(__dirname, '../preload/preload.js'),
      // 安全配置——显式声明所有关键选项（不依赖 Electron 默认值）
      sandbox: true,           // 开启 Chromium 沙箱保护（preload 只用 contextBridge/ipcRenderer，完全兼容）
      contextIsolation: true,  // 渲染进程与 preload 隔离——防止 XSS 攻击访问 Node API
      nodeIntegration: false,  // 禁止渲染进程直接使用 Node.js
      webSecurity: true        // 启用 Web 安全策略（同源检测等）
    }
  })

  // 窗口准备好后才显示（避免白屏闪烁，类似 App 的启动画面）
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // 窗口内点击链接时的处理：用系统默认浏览器打开，而不是在应用内打开
  mainWindow.webContents.setWindowOpenHandler((details) => {
    // 只允许 http/https 协议，防止 file:// 等协议读取本地文件
    try {
      const url = new URL(details.url)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        shell.openExternal(details.url)
      }
    } catch { /* 无效 URL 静默忽略 */ }
    return { action: 'deny' }  // 拒绝在应用内打开新窗口
  })

  // 根据环境加载不同的 URL
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    // 开发模式：连接 Vite 开发服务器（仅允许 localhost 防止注入恶意地址）
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    try {
      const parsed = new URL(devUrl)
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        mainWindow.loadURL(devUrl)
      } else {
        // 非 localhost 的 URL 拒绝加载，回退到打包后的文件
        mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
      }
    } catch {
      mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
    }
  } else {
    // 生产模式：加载打包后的 HTML 文件
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ====== IPC 通信处理 ======
/**
 * IPC（进程间通信）：渲染进程不能直接操作数据库或文件系统，
 * 必须通过 IPC 发送请求给主进程，主进程执行完后返回结果。
 *
 * ipcMain.handle('通道名', 处理函数) —— 主进程注册一个"服务"
 * ipcRenderer.invoke('通道名', 参数) —— 渲染进程调用这个"服务"
 *
 * 类比：就像前台服务员（渲染进程）收到顾客点单后，
 * 通过传菜窗口（IPC）告诉后厨（主进程），后厨做好菜再传回来
 */
function setupIpcHandlers(): void {
  // ---- 数据库操作 ----
  // 查询多条记录（如查所有分类、本月账目）
  ipcMain.handle('db:queryAll', (_event, sql: string, params?: unknown[]) => {
    return queryAll(sql, params || [])
  })

  // 查询单条记录（如查月度统计）
  ipcMain.handle('db:queryOne', (_event, sql: string, params?: unknown[]) => {
    return queryOne(sql, params || [])
  })

  // 执行写操作（INSERT / UPDATE / DELETE）
  ipcMain.handle('db:execute', (_event, sql: string, params?: unknown[]) => {
    return execute(sql, params || [])
  })

  // ---- 分类管理（专用通道，业务逻辑更清晰） ----
  ipcMain.handle('category:add', (_event, params: { type: string; name: string; icon: string; parentId: number | null; sortOrder: number }) => {
    return addCategory(params)
  })

  ipcMain.handle('category:update', (_event, id: number, name: string, icon: string) => {
    return updateCategory(id, name, icon)
  })

  ipcMain.handle('category:delete', (_event, id: number) => {
    return deleteCategory(id)
  })

  // ---- 文件操作 ----

  // 保存文件对话框（导出 CSV 时用）
  ipcMain.handle('dialog:saveFile', async (_event, options: { defaultName: string; filters: { name: string; extensions: string[] }[] }) => {
    if (!mainWindow) return null
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: options.defaultName,
      filters: options.filters
    })
    return result.canceled ? null : result.filePath
  })

  // 写入文件到磁盘
  // 注意：写入时添加 UTF-8 BOM 头，让 Excel 能正确识别中文
  ipcMain.handle('file:write', (_event, filePath: string, content: string) => {
    const bom = '﻿'  // UTF-8 BOM 标记
    writeFileSync(filePath, bom + content, 'utf-8')
    return true
  })

  // 打开文件对话框（导入 CSV 时用）
  ipcMain.handle('dialog:openFile', async (_event, options: { filters: { name: string; extensions: string[] }[] }) => {
    if (!mainWindow) return null
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],   // 只允许选文件，不能选文件夹
      filters: options.filters
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  // 读取文件内容
  ipcMain.handle('file:read', (_event, filePath: string) => {
    return readFileSync(filePath, 'utf-8')
  })
}

// ====== 应用生命周期 ======

// app.whenReady() —— 应用初始化完成后执行
app.whenReady().then(async () => {
  // 1. 先初始化数据库（创建表结构）
  await initDatabase()
  // 2. 注册所有 IPC 通信通道
  setupIpcHandlers()
  // 3. 创建窗口显示界面
  createWindow()

  // macOS 特性：点击 Dock 图标时如果没窗口就创建一个
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 所有窗口关闭时
app.on('window-all-closed', () => {
  closeDatabase()  // 优雅关闭数据库连接
  // macOS 下通常不退出应用（留在 Dock 上），Windows 下直接退出
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
