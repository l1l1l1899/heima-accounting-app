/**
 * 记账页面 —— "记一笔"的核心功能
 *
 * 用户可以在这里记录一笔支出或收入：
 * 1. 选择类型（支出 / 收入）
 * 2. 选择一级分类 + 二级分类（两级联动）
 * 3. 输入金额
 * 4. 选择日期（默认今天）
 * 5. 写备注（可选）
 *
 * 类比：就像在手机记账 App 里点击"记一笔"，填几个字段就能完成记账
 */
import { useState, useEffect } from 'react'
import {
  Card, Form, Select, InputNumber, DatePicker, Input, Button, message, Radio, Typography
} from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { useAppStore } from '../stores/useAppStore'
import dayjs from 'dayjs'

const { Title } = Typography

export default function RecordPage(): JSX.Element {
  const [form] = Form.useForm()
  // 当前选中的记账类型：支出 or 收入
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense')
  // 当前选中的一级分类 ID（切换后联动更新二级分类选项）
  const [selectedL1, setSelectedL1] = useState<number | null>(null)
  // 是否正在提交中（防止重复点击）
  const [submitting, setSubmitting] = useState(false)

  // 从全局状态获取分类数据和加载函数
  const {
    expenseLevel1,
    expenseLevel2Map,
    incomeLevel1,
    incomeLevel2Map,
    loadAll
  } = useAppStore()

  // 页面打开时加载数据
  useEffect(() => {
    loadAll()
  }, [])

  // 根据当前选择的类型（支出/收入）动态切换分类列表
  const level1Categories = transactionType === 'expense' ? expenseLevel1 : incomeLevel1
  // 二级分类列表 = 当前选中的一级分类的下级
  const level2Categories = selectedL1
    ? (transactionType === 'expense' ? expenseLevel2Map : incomeLevel2Map)[selectedL1] || []
    : []

  // ====== 提交记账 ======
  /**
   * 提交流程：
   * 1. 校验表单（必填项、金额范围）
   * 2. 根据选中的分类 ID 找到分类名称
   * 3. 调用 store 的 addTransaction 存入数据库
   * 4. 成功后重置表单，可以继续记下一笔
   */
  const handleSubmit = async (): Promise<void> => {
    try {
      // 先校验表单，不通过会抛出带有 errorFields 的异常
      const values = await form.validateFields()
      setSubmitting(true)

      // 根据选中的 ID 找到对应的分类名称
      const l1Category = level1Categories.find(c => c.id === values.categoryL1)
      const l2Category = level2Categories.find(c => c.id === values.categoryL2)

      // 调用 store 添加账目
      await useAppStore.getState().addTransaction({
        type: transactionType,
        amount: values.amount,
        categoryL1: l1Category?.name || '',
        categoryL2: l2Category?.name || '',
        date: values.date.format('YYYY-MM-DD'),
        note: values.note || ''
      })

      message.success('记账成功！')
      // 重置表单，方便记下一笔（保留日期和类型）
      form.resetFields()
      setSelectedL1(null)
    } catch (err) {
      // 区分两种情况：
      // 1. errorFields 存在 → 表单校验没通过，不用额外提示（表单已自动标红）
      // 2. 其他错误 → 真正的操作失败，显示错误提示
      if (err && typeof err === 'object' && 'errorFields' in err) {
        // 表单校验失败，什么都不用做（字段已自动标红）
      } else {
        message.error('记账失败，请重试')
        console.error(err)
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Card>
        <Title level={4} style={{ marginBottom: 24, textAlign: 'center' }}>
          记一笔
        </Title>

        {/* ====== 类型切换：支出 / 收入 ====== */}
        {/* 切换类型时，重置分类选择（因为支出和收入的分类不同） */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Radio.Group
            value={transactionType}
            onChange={e => {
              setTransactionType(e.target.value)
              setSelectedL1(null)                         // 清空一级分类选择
              form.resetFields(['categoryL1', 'categoryL2']) // 清空分类字段
            }}
            size="large"
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="expense" style={{ padding: '0 32px' }}>
              💸 支出
            </Radio.Button>
            <Radio.Button value="income" style={{ padding: '0 32px' }}>
              💰 收入
            </Radio.Button>
          </Radio.Group>
        </div>

        <Form
          form={form}
          layout="vertical"
          initialValues={{
            date: dayjs(),        // 默认日期 = 今天
            amount: undefined     // 金额不设默认值
          }}
        >
          {/* ====== 一级分类 ====== */}
          <Form.Item
            label="分类（一级）"
            name="categoryL1"
            rules={[{ required: true, message: '请选择一级分类' }]}
          >
            <Select
              placeholder="选择大类"
              size="large"
              onChange={(value: number) => {
                setSelectedL1(value)                    // 记录选中的一级分类
                form.resetFields(['categoryL2'])        // 清空二级分类（因为选项变了）
              }}
              options={level1Categories.map(c => ({
                value: c.id,
                label: `${c.icon} ${c.name}`
              }))}
            />
          </Form.Item>

          {/* ====== 二级分类 ====== */}
          {/* 只有选了一级分类后才能选二级分类（disabled 控制） */}
          <Form.Item
            label="分类（二级）"
            name="categoryL2"
            rules={[{ required: true, message: '请选择二级分类' }]}
          >
            <Select
              placeholder={selectedL1 ? '选择小类' : '请先选择一级分类'}
              size="large"
              disabled={!selectedL1}                    // 没选一级时不可用
              options={level2Categories.map(c => ({
                value: c.id,
                label: `${c.icon} ${c.name}`
              }))}
            />
          </Form.Item>

          {/* ====== 金额 ====== */}
          <Form.Item
            label={`金额（${transactionType === 'expense' ? '花了多少' : '收入多少'}？）`}
            name="amount"
            rules={[
              { required: true, message: '请输入金额' },
              { type: 'number', min: 0.01, message: '金额必须大于0' }
            ]}
          >
            <InputNumber
              placeholder="0.00"
              size="large"
              style={{ width: '100%' }}
              prefix="¥"
              precision={2}              // 最多两位小数
              min={0.01}                 // 最小 1 分钱
              max={99999999.99}          // 最大约 1 亿
              addonAfter="元"
            />
          </Form.Item>

          {/* ====== 日期 ====== */}
          <Form.Item
            label="日期"
            name="date"
            rules={[{ required: true, message: '请选择日期' }]}
          >
            <DatePicker
              size="large"
              style={{ width: '100%' }}
              format="YYYY-MM-DD"
            />
          </Form.Item>

          {/* ====== 备注（选填） ====== */}
          <Form.Item
            label="备注（选填）"
            name="note"
          >
            <Input.TextArea
              placeholder="写点什么..."
              maxLength={200}            // 最多 200 字
              showCount                  // 显示字数统计
              rows={2}
              size="large"
            />
          </Form.Item>

          {/* ====== 提交按钮 ====== */}
          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              size="large"
              block                       // 占满整行宽度
              icon={<SaveOutlined />}
              onClick={handleSubmit}
              loading={submitting}        // 提交中显示转圈
            >
              保存记录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}
