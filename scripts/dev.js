// 黑马记账 开发启动脚本
// 清除 ELECTRON_RUN_AS_NODE 环境变量后启动 electron-vite

const { spawn } = require('child_process')
const path = require('path')

// 从环境中彻底移除 ELECTRON_RUN_AS_NODE
delete process.env.ELECTRON_RUN_AS_NODE

// electron-vite 的入口 JS 文件
const cliEntry = path.resolve(
  __dirname, '..', 'node_modules', 'electron-vite', 'bin', 'electron-vite.js'
)

// 创建干净的环境变量
const cleanEnv = {}
for (const key of Object.keys(process.env)) {
  if (key !== 'ELECTRON_RUN_AS_NODE') {
    cleanEnv[key] = process.env[key]
  }
}

// 直接用 node 运行 electron-vite 的入口文件
const child = spawn(process.execPath, [cliEntry, 'dev'], {
  stdio: 'inherit',
  env: cleanEnv
})

child.on('error', (err) => {
  console.error('Failed to start electron-vite:', err.message)
  process.exit(1)
})

child.on('exit', (code) => {
  process.exit(code || 0)
})
