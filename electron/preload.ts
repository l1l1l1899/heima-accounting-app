/**
 * Electron Preload 脚本 —— 主进程和渲染进程之间的"安全桥梁"
 *
 * 为什么需要 preload？
 * - 渲染进程（网页）不能直接访问 Node.js API（出于安全考虑）
 * - preload 脚本运行在一个特权环境中，可以同时访问 Node.js 和浏览器
 * - 通过 contextBridge 把主进程的能力"安全地"暴露给渲染进程
 *
 * 类比：preload 就像银行柜台的防弹玻璃——
 *   你（渲染进程）隔着玻璃告诉柜员（preload）要办什么事，
 *   柜员帮你操作后台系统（主进程），但你不能直接翻进后台
 *
 * 安全注意：
 * - 只暴露渲染进程真正需要的方法，不要什么都暴露
 * - 每个方法都是单向的（渲染进程请求 → 主进程响应）
 * - contextBridge 确保攻击者无法通过 XSS 注入篡改暴露的 API
 */
import { contextBridge, ipcRenderer } from 'electron'

// contextBridge.exposeInMainWorld：在渲染进程的 window 对象上挂载 API
// 渲染进程中通过 window.electronAPI 调用这些方法
contextBridge.exposeInMainWorld('electronAPI', {
  // ====== 数据库操作 ======
  // 这些方法把渲染进程的请求通过 IPC 转发给主进程的 database 模块
  db: {
    /** 查询多条记录 */
    queryAll: (sql: string, params?: unknown[]) =>
      ipcRenderer.invoke('db:queryAll', sql, params),

    /** 查询单条记录 */
    queryOne: (sql: string, params?: unknown[]) =>
      ipcRenderer.invoke('db:queryOne', sql, params),

    /** 执行写操作（INSERT / UPDATE / DELETE） */
    execute: (sql: string, params?: unknown[]) =>
      ipcRenderer.invoke('db:execute', sql, params)
  },

  // ====== 分类管理（专门的业务通道） ======
  category: {
    /** 添加自定义分类 */
    add: (params: { type: string; name: string; icon: string; parentId: number | null; sortOrder: number }) =>
      ipcRenderer.invoke('category:add', params),

    /** 更新分类名称和图标 */
    update: (id: number, name: string, icon: string) =>
      ipcRenderer.invoke('category:update', id, name, icon),

    /** 删除分类及其子分类 */
    delete: (id: number) =>
      ipcRenderer.invoke('category:delete', id)
  },

  // ====== 文件对话框（打开/保存） ======
  dialog: {
    /** 弹出保存文件对话框，返回用户选择的保存路径 */
    saveFile: (options: { defaultName: string; filters: { name: string; extensions: string[] }[] }) =>
      ipcRenderer.invoke('dialog:saveFile', options),

    /** 弹出打开文件对话框，返回用户选择的文件路径 */
    openFile: (options: { filters: { name: string; extensions: string[] }[] }) =>
      ipcRenderer.invoke('dialog:openFile', options)
  },

  // ====== 文件读写 ======
  file: {
    /** 将内容写入指定路径的文件 */
    write: (filePath: string, content: string) =>
      ipcRenderer.invoke('file:write', filePath, content),

    /** 读取指定路径文件的内容 */
    read: (filePath: string) =>
      ipcRenderer.invoke('file:read', filePath)
  },

  // ====== 应用信息 ======
  platform: process.platform,   // 当前操作系统（'win32' / 'darwin' / 'linux'）
  isElectron: true              // 标记这是 Electron 环境（区别于浏览器）
})
