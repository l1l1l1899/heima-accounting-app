import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // 使用 jsdom 模拟浏览器环境（React 组件需要）
    environment: 'jsdom',
    // 测试文件所在目录
    include: ['src/**/*.test.{ts,tsx}'],
    // 全局变量（让 test、expect 等不用手动 import）
    globals: true,
    // 浏览器 API 模拟（Ant Design 需要）
    setupFiles: ['./src/test-setup.ts'],
    // 设置超时时间
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
})
