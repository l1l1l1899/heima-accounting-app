/**
 * App 根组件 —— 整个应用的"骨架"
 *
 * 负责三件事：
 * 1. 左侧导航菜单 —— 点击切换不同页面（首页、记账、统计等）
 * 2. 顶部标题栏 —— 显示当前页面的名字
 * 3. 右侧内容区 —— 展示当前选中的页面
 *
 * 类比：就像一个带标签页的笔记本，左侧是目录，右侧是正文
 */
import { useState } from 'react'
import { Layout, Menu, Typography } from 'antd'
import type { MenuProps } from 'antd'
import {
  HomeOutlined,
  PlusCircleOutlined,
  PieChartOutlined,
  SettingOutlined,
  AppstoreOutlined,
  BugOutlined
} from '@ant-design/icons'

// 导入各个页面组件
import HomePage from './pages/HomePage'
import RecordPage from './pages/RecordPage'
import StatisticsPage from './pages/StatisticsPage'
import SettingsPage from './pages/SettingsPage'
import CategoryPage from './pages/CategoryPage'
import SnakeGame from './components/SnakeGame'

// Ant Design Layout 的组成部分：
// Sider = 侧边栏, Header = 顶栏, Content = 内容区
const { Header, Sider, Content } = Layout
const { Title } = Typography

/** 所有页面的标识（key），用于匹配菜单选中状态 */
type PageKey = 'home' | 'record' | 'statistics' | 'categories' | 'settings' | 'snake'

/**
 * 左侧菜单配置
 * 每个菜单项有一个 key（页面标识）、icon（图标）、label（显示文字）
 * 点击菜单项时，用 key 来切换右侧显示的页面
 */
const menuItems: MenuProps['items'] = [
  { key: 'home', icon: <HomeOutlined />, label: '首页' },
  { key: 'record', icon: <PlusCircleOutlined />, label: '记一笔' },
  { key: 'statistics', icon: <PieChartOutlined />, label: '统计' },
  { key: 'categories', icon: <AppstoreOutlined />, label: '分类管理' },
  { key: 'snake', icon: <BugOutlined />, label: '🐍 贪吃蛇' },
  { key: 'settings', icon: <SettingOutlined />, label: '设置' }
]

function App(): JSX.Element {
  // currentPage 记录当前选中的页面，默认显示"首页"
  const [currentPage, setCurrentPage] = useState<PageKey>('home')

  /**
   * 根据 currentPage 的值渲染对应的页面组件
   * 就像一个遥控器：按哪个键就显示哪个频道
   */
  const renderPage = (): JSX.Element => {
    switch (currentPage) {
      case 'home':
        return <HomePage />
      case 'record':
        return <RecordPage />
      case 'statistics':
        return <StatisticsPage />
      case 'categories':
        return <CategoryPage />
      case 'snake':
        return <SnakeGame />
      case 'settings':
        return <SettingsPage />
    }
  }

  return (
    // Layout 是三栏布局：左（菜单）+ 右（顶栏 + 内容）
    <Layout style={{ minHeight: '100vh' }}>
      {/* ====== 左侧导航栏 ====== */}
      <Sider
        breakpoint="lg"           // 屏幕不够宽时自动收起
        collapsedWidth="60"       // 收起后只显示图标，宽度 60px
        theme="light"
        style={{ borderRight: '1px solid #f0f0f0' }}
      >
        {/* Logo 区域：显示应用名称 */}
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <Title level={4} style={{ margin: 0 }}>🐴 黑马记账</Title>
        </div>

        {/* 菜单：点击哪个就切换到哪个页面 */}
        <Menu
          mode="inline"                              // 垂直排列模式
          selectedKeys={[currentPage]}               // 当前选中的菜单项高亮
          items={menuItems}                          // 菜单项列表
          onClick={({ key }) => setCurrentPage(key as PageKey)}  // 点击时更新 currentPage
          style={{ borderRight: 0, marginTop: 8 }}
        />
      </Sider>

      {/* ====== 右侧：顶栏 + 内容区 ====== */}
      <Layout>
        {/* 顶部标题栏：显示当前页面名称 */}
        <Header style={{
          background: '#fff',
          padding: '0 24px',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center'
        }}>
          <Title level={5} style={{ margin: 0 }}>
            {/* 根据 currentPage 找到对应菜单项的 label 作为标题 */}
            {menuItems.find(item => item?.key === currentPage)?.label as string || '首页'}
          </Title>
        </Header>

        {/* 内容区：渲染当前选中的页面 */}
        <Content style={{ padding: 24, background: '#f5f5f5', overflow: 'auto' }}>
          {renderPage()}
        </Content>
      </Layout>
    </Layout>
  )
}

export default App
