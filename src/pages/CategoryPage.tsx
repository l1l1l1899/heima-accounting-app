/**
 * 分类管理页面 —— 管理记账的一级和二级分类
 *
 * 这个页面可以：
 * 1. 查看支出和收入两大类下的所有分类（Tab 切换）
 * 2. 添加一级分类（如添加"宠物"大类）
 * 3. 在一级分类下添加二级分类（如在"餐饮"下添加"下午茶"）
 * 4. 编辑自定义分类的名称和图标
 * 5. 删除自定义分类（系统预置分类不可删）
 *
 * 类比：就像文件夹管理——一级分类是文件夹，二级分类是里面的文件
 */
import { useState, useEffect } from 'react'
import {
  Card, Tabs, Button, Space, Typography, Tag, Popconfirm,
  Modal, Form, Input, Select, message, Empty, Tooltip
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  LockOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import { useAppStore } from '../stores/useAppStore'
import type { Category, TransactionType } from '../types'

const { Title, Text } = Typography

/**
 * 常用 emoji 图标列表 —— 给用户选择分类图标用的
 * 分类为：食物、交通、购物、居住、娱乐、医疗、教育、人情、数码、金融、通用
 */
const EMOJI_OPTIONS = [
  '🍜', '🚗', '🛒', '🏠', '🎮', '🏥', '📚', '🎁', '📱', '💰', '📦',
  '💼', '📈', '🍕', '☕', '🎬', '✈️', '🏋️', '💊', '📖', '🧧', '💻',
  '🛍️', '🏖️', '🎵', '🐱', '🐶', '🌱', '💡', '⭐', '🔥', '❤️',
  '🍺', '🚌', '👗', '💄', '🪴', '🎓', '🏆', '💎', '🌈', '🎂'
]

export default function CategoryPage(): JSX.Element {
  // 从全局状态中取出分类数据和操作方法
  const {
    expenseLevel1,       // 支出的一级分类列表
    expenseLevel2Map,    // 支出的二级分类映射（一级分类ID → 二级分类列表）
    incomeLevel1,        // 收入的一级分类列表
    incomeLevel2Map,     // 收入的二级分类映射
    addCategory,         // 添加分类
    updateCategory,      // 更新分类
    removeCategory,      // 删除分类
    reloadCategories     // 重新加载分类数据
  } = useAppStore()

  // ====== 本地 UI 状态 ======
  const [activeTab, setActiveTab] = useState<TransactionType>('expense')  // 当前 Tab：支出 or 收入
  const [modalOpen, setModalOpen] = useState(false)                       // 弹窗是否打开
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')       // 弹窗模式：添加 or 编辑
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)  // 正在编辑的分类
  const [form] = Form.useForm()                                           // Ant Design 表单实例
  const [submitting, setSubmitting] = useState(false)                     // 是否正在提交中
  const [selectedIcon, setSelectedIcon] = useState('📦')                  // 当前选中的图标

  // 页面加载时获取分类数据
  useEffect(() => {
    reloadCategories()
  }, [])

  // 根据当前 Tab 选择对应的分类数据
  const level1List = activeTab === 'expense' ? expenseLevel1 : incomeLevel1
  const level2Map = activeTab === 'expense' ? expenseLevel2Map : incomeLevel2Map

  // ====== 打开新增一级分类弹窗 ======
  const handleAddLevel1 = (): void => {
    setModalMode('add')
    setEditingCategory(null)
    setSelectedIcon('📦')
    form.resetFields()                          // 清空表单
    form.setFieldsValue({ parentId: undefined }) // 不选父分类 = 一级分类
    setModalOpen(true)
  }

  // ====== 打开新增二级分类弹窗 ======
  const handleAddLevel2 = (parentId: number): void => {
    setModalMode('add')
    setEditingCategory(null)
    setSelectedIcon('📦')
    form.resetFields()
    form.setFieldsValue({ parentId })  // 预设好父分类
    setModalOpen(true)
  }

  // ====== 打开编辑弹窗 ======
  const handleEdit = (cat: Category): void => {
    setModalMode('edit')
    setEditingCategory(cat)
    setSelectedIcon(cat.icon)
    form.setFieldsValue({ name: cat.name, parentId: undefined })
    setModalOpen(true)
  }

  // ====== 删除分类 ======
  /**
   * 删除时弹出确认框
   * 如果是一级分类且有子分类，会提示子分类也会一起被删
   */
  const handleDelete = async (cat: Category): Promise<void> => {
    // 检查该分类下是否有二级子分类
    const childCount = level2Map[cat.id]?.length || 0
    const warningText = cat.parentId === null && childCount > 0
      ? `该分类下有 ${childCount} 个二级分类，将一起被删除。`
      : ''

    Modal.confirm({
      title: `确认删除「${cat.name}」？`,
      icon: <ExclamationCircleOutlined />,
      content: warningText || '删除后不可恢复。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        await removeCategory(cat.id)
        message.success('分类已删除')
      }
    })
  }

  // ====== 提交表单（新增或编辑） ======
  /**
   * 统一处理新增和编辑的提交逻辑
   * 1. 先校验表单
   * 2. 新增时计算 sortOrder（新分类排到最后）
   * 3. 调用对应的 store action
   */
  const handleSubmit = async (): Promise<void> => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)

      if (modalMode === 'add') {
        // 新增模式：计算新分类的排序位置
        // sortOrder = 同级最大的序号 + 1（新分类排最后）
        const siblings = values.parentId
          ? (level2Map[values.parentId] || [])   // 有父分类 → 找同级二级分类
          : level1List                            // 无父分类 → 找同级一级分类
        const maxSort = siblings.reduce((max, c) => Math.max(max, c.sortOrder), 0)

        await addCategory({
          type: activeTab,
          name: values.name.trim(),
          icon: selectedIcon,
          parentId: values.parentId || null,
          sortOrder: maxSort + 1
        })
        message.success('分类已添加')
      } else if (editingCategory) {
        // 编辑模式：只更新名称和图标
        await updateCategory(editingCategory.id, values.name.trim(), selectedIcon)
        message.success('分类已更新')
      }

      setModalOpen(false)
    } catch (err) {
      // 区分：表单校验失败 vs 真正的操作失败
      if (err && typeof err === 'object' && 'errorFields' in err) {
        // Ant Design 表单校验失败 —— 什么都不做，表单会自动显示错误提示
      } else {
        message.error('操作失败')
        console.error(err)
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ====== 渲染单个分类标签 ======
  /**
   * 渲染一个分类条（一级或二级）
   * 包含：图标 + 名称 + 操作按钮（编辑/删除）
   * 系统预置分类显示🔒锁定标记，不可操作
   *
   * @param cat - 分类数据
   * @param isChild - 是否为二级分类（二级分类左边缩进一点）
   */
  const renderCategoryTag = (cat: Category, isChild = false): JSX.Element => (
    <div
      key={cat.id}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        marginBottom: 4,
        background: isChild ? '#fafafa' : '#fff',  // 二级分类背景略灰
        borderRadius: 6,
        border: '1px solid #f0f0f0'
      }}
    >
      <Space>
        <span style={{ fontSize: 20 }}>{cat.icon}</span>
        <Text strong={!isChild}>{cat.name}</Text>
        {/* 系统预置分类标记：带锁图标 */}
        {cat.isPreset && (
          <Tooltip title="系统预置分类，不可修改">
            <Tag icon={<LockOutlined />} color="default" style={{ fontSize: 11 }}>
              预置
            </Tag>
          </Tooltip>
        )}
      </Space>

      {/* 只有自定义分类才显示编辑和删除按钮 */}
      {!cat.isPreset && (
        <Space size="small">
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(cat)}
          />
          <Popconfirm
            title="确定删除？"
            onConfirm={() => handleDelete(cat)}
            okText="删除"
            cancelText="取消"
          >
            <Button type="text" size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )}
    </div>
  )

  // ====== 渲染一级分类区块 ======
  /**
   * 渲染一个一级分类及其下面的所有二级分类
   * 结构：
   * ┌──────────────┐
   * │ 🍜 餐饮  [编辑] [删除]  │  ← 一级分类行
   * │   ☕ 早餐  [编辑] [删除] │  ← 二级分类行（缩进）
   * │   🍚 午餐  [编辑] [删除] │
   * │   [+ 添加二级分类]       │  ← 添加按钮
   * └──────────────┘
   */
  const renderLevel1Block = (l1: Category): JSX.Element => {
    const children = level2Map[l1.id] || []  // 该一级分类下的所有二级分类
    return (
      <Card
        key={l1.id}
        size="small"
        style={{ marginBottom: 12 }}
        title={null}
      >
        {/* 一级分类行 */}
        {renderCategoryTag(l1)}

        {/* 二级分类列表（略微缩进，形成层级感） */}
        <div style={{ marginLeft: 24, marginTop: 4 }}>
          {children.map(child => renderCategoryTag(child, true))}

          {/* 在一级分类下添加二级分类的按钮 */}
          <Button
            type="dashed"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => handleAddLevel2(l1.id)}
            style={{ marginTop: 4, width: '100%' }}
          >
            添加「{l1.name}」下的二级分类
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      {/* 页面说明 */}
      <Card style={{ marginBottom: 16 }}>
        <Title level={4}>📂 分类管理</Title>
        <Text type="secondary">
          管理记账分类。🔒 标记的为系统预置分类，不可修改或删除。
          你可以自由添加、修改、删除自定义分类。
        </Text>
      </Card>

      {/* ====== Tab 切换：支出分类 / 收入分类 ====== */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as TransactionType)}
        size="large"
        // Tab 栏右侧的"添加一级分类"按钮
        tabBarExtraContent={
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddLevel1}>
            添加一级分类
          </Button>
        }
        items={[
          {
            key: 'expense',
            label: '💸 支出分类',
            children: (
              <div>
                {level1List.length > 0
                  ? level1List.map(renderLevel1Block)
                  : <Empty description="暂无支出分类" />
                }
              </div>
            )
          },
          {
            key: 'income',
            label: '💰 收入分类',
            children: (
              <div>
                {level1List.length > 0
                  ? level1List.map(renderLevel1Block)
                  : <Empty description="暂无收入分类" />
                }
              </div>
            )
          }
        ]}
      />

      {/* ====== 新增/编辑弹窗 ====== */}
      <Modal
        title={modalMode === 'add' ? '添加分类' : '编辑分类'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={submitting}         // 提交时按钮转圈
        okText={modalMode === 'add' ? '添加' : '保存'}
        cancelText="取消"
        destroyOnClose                      // 关闭弹窗时销毁内容（重置状态）
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          {/* ====== 图标选择 ====== */}
          <Form.Item label="图标">
            {/* emoji 选择网格：点击即可选中 */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 8,
              maxHeight: 160,
              overflow: 'auto'     // 图标太多时可滚动
            }}>
              {EMOJI_OPTIONS.map(emoji => (
                <div
                  key={emoji}
                  onClick={() => setSelectedIcon(emoji)}
                  style={{
                    fontSize: 24,
                    padding: '4px 8px',
                    cursor: 'pointer',
                    borderRadius: 6,
                    // 选中的图标高亮（蓝色边框 + 蓝色背景）
                    border: selectedIcon === emoji ? '2px solid #1677ff' : '2px solid transparent',
                    background: selectedIcon === emoji ? '#e6f4ff' : 'transparent'
                  }}
                >
                  {emoji}
                </div>
              ))}
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              当前选择：{selectedIcon}
            </Text>
          </Form.Item>

          {/* ====== 分类名称 ====== */}
          <Form.Item
            label="分类名称"
            name="name"
            rules={[
              { required: true, message: '请输入分类名称' },
              { max: 10, message: '最多10个字' }
            ]}
          >
            <Input placeholder="例如：宠物用品" maxLength={10} />
          </Form.Item>

          {/* ====== 上级分类（仅新增时显示） ====== */}
          {/* 留空 = 一级分类；选择了某个一级分类 = 它的二级分类 */}
          {modalMode === 'add' && (
            <Form.Item
              label="上级分类"
              name="parentId"
              tooltip="留空 = 一级分类，选择 = 二级分类"
            >
              <Select
                allowClear
                placeholder="留空表示添加为一级分类"
                options={level1List.map(c => ({
                  value: c.id,
                  label: `${c.icon} ${c.name}`
                }))}
              />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  )
}
