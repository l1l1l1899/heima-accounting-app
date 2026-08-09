/**
 * Vitest + jsdom 测试环境初始化
 * 模拟浏览器 API（Ant Design 等组件库依赖）
 */
import '@testing-library/jest-dom'

// Mock window.matchMedia（Ant Design 响应式组件需要）
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},   // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// Mock getComputedStyle（Ant Design 某些组件需要）
const originalGetComputedStyle = window.getComputedStyle
window.getComputedStyle = (elt: Element, pseudoElt?: string | null) => {
  const style = originalGetComputedStyle(elt, pseudoElt)
  // 避免 "Not implemented" 错误
  return style
}
