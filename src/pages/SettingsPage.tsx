/**
 * 设置页面 —— 数据管理（导入/导出/清空）
 *
 * 提供三个功能：
 * 1. 导出 CSV —— 把所有账目导出为 Excel 可打开的文件，用于备份
 * 2. 导入 CSV —— 从之前导出的文件恢复数据
 * 3. 清空数据 —— 删除所有账目（有确认弹窗，不可撤销）
 *
 * 类比：就像手机相册的"导出到电脑"和"从备份恢复"功能
 */
import { useState } from 'react'
import { Card, Button, Space, Typography, message, Modal, Divider, Alert } from 'antd'
import {
  ExportOutlined,
  ImportOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import * as db from '../database/api'

const { Title, Paragraph, Text } = Typography

// ============================================================
// CSV 工具函数
// ============================================================

/**
 * 对 CSV 字段进行转义处理
 *
 * CSV 格式规定：如果字段内容包含逗号、双引号或换行符，
 * 必须用双引号包裹整个字段，且内部的双引号要变成两个双引号（""）
 *
 * 类比：就像寄快递时，易碎品需要额外包裹泡沫纸
 *
 * @param value - 原始字段内容（如 "午餐, 面条"）
 * @returns 转义后的安全字段（如 "\"午餐, 面条\""）
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return '"' + value.replace(/"/g, '""') + '"'
  }
  return value
}

/**
 * 解析一行 CSV 文本，返回字段数组
 *
 * CSV 解析规则：
 * - 逗号分隔字段
 * - 双引号包裹的字段内部可以包含逗号（不会被当作分隔符）
 * - 两个连续双引号（""）表示一个转义的双引号字符
 *
 * 这是一个手写的状态机解析器：
 * - inQuotes = false：在引号外部，逗号 = 分隔符
 * - inQuotes = true：在引号内部，逗号 = 普通字符
 *
 * @param line - 一行 CSV 文本（如 '支出,50.00,餐饮,午餐,2024-06-15,"备注, 有逗号"'）
 * @returns 解析后的字段数组
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      // 在引号内部：遇到双引号要判断是结束引号还是转义引号
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          // 两个连续双引号 → 转义为一个双引号
          current += '"'
          i++
        } else {
          // 单个双引号 → 引号结束
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      // 在引号外部
      if (ch === '"') {
        inQuotes = true         // 进入引号内部
      } else if (ch === ',') {
        result.push(current.trim())  // 逗号 = 字段分隔
        current = ''
      } else {
        current += ch
      }
    }
  }
  // 最后一个字段（行末没有逗号）
  result.push(current.trim())
  return result
}

export default function SettingsPage(): JSX.Element {
  // 三个操作各自的加载状态
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [clearing, setClearing] = useState(false)

  // ====== 导出数据 ======
  /**
   * 导出流程：
   * 1. 从数据库查所有账目
   * 2. 拼成 CSV 格式的文本
   * 3. 弹出保存对话框让用户选择存哪里
   * 4. 写入文件
   */
  const handleExport = async (): Promise<void> => {
    setExporting(true)
    try {
      // 获取所有账目（limit 设很大 = 全部取出）
      const transactions = await db.getTransactions({ limit: 999999 })
      if (transactions.length === 0) {
        message.warning('没有数据可以导出')
        return
      }

      // 构建 CSV 内容：第一行是表头，后面每行是一条记录
      const header = '类型,金额,一级分类,二级分类,日期,备注'
      const rows = transactions.map(t => {
        const typeName = t.type === 'expense' ? '支出' : '收入'
        // 把每条记录的字段逐个转义后用逗号拼接
        return [
          typeName,
          t.amount.toFixed(2),
          t.category_l1,
          t.category_l2,
          t.date,
          t.note
        ].map(escapeCsvField).join(',')
      })
      const csvContent = [header, ...rows].join('\n')

      // 生成默认文件名：黑马记账_数据导出_2024-06-15.csv
      const now = new Date()
      const defaultName = `黑马记账_数据导出_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.csv`

      // 弹出系统保存文件对话框
      const filePath = await window.electronAPI.dialog.saveFile({
        defaultName,
        filters: [{ name: 'CSV 文件', extensions: ['csv'] }]
      })

      if (filePath) {
        await window.electronAPI.file.write(filePath, csvContent)
        message.success(`成功导出 ${transactions.length} 条记录！`)
      }
    } catch (err) {
      message.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  // ====== 导入数据 ======
  /**
   * 导入流程：
   * 1. 弹出打开文件对话框让用户选 CSV 文件
   * 2. 读取文件内容
   * 3. 逐行解析 CSV
   * 4. 逐条写入数据库
   *
   * 注意：导入不会覆盖已有数据，新数据会追加进去
   */
  const handleImport = async (): Promise<void> => {
    const filePath = await window.electronAPI.dialog.openFile({
      filters: [{ name: 'CSV 文件', extensions: ['csv'] }]
    })

    if (!filePath) return  // 用户取消了选择

    setImporting(true)
    try {
      const content = await window.electronAPI.file.read(filePath)
      // 去掉 UTF-8 BOM（某些编辑器会在文件开头加一个不可见字符 ﻿）
      const cleanContent = content.replace(/^﻿/, '')

      // 按行拆分，过滤空行
      const lines = cleanContent.split('\n').filter(line => line.trim())
      if (lines.length < 2) {
        message.error('CSV 文件格式不正确')
        return
      }

      // 跳过第一行（表头），从第二行开始是数据
      const dataLines = lines.slice(1)
      let successCount = 0   // 成功导入的条数
      let skipCount = 0      // 跳过的条数（格式不对）

      for (const line of dataLines) {
        const fields = parseCsvLine(line)
        if (fields.length < 5) {
          skipCount++    // 字段数不够 → 跳过
          continue
        }

        const [typeName, amountStr, categoryL1, categoryL2, date, note] = fields
        const type = typeName === '收入' ? 'income' : 'expense'
        const amount = parseFloat(amountStr)

        // 验证金额合法性
        if (isNaN(amount) || amount <= 0) {
          skipCount++
          continue
        }

        // 验证日期格式（YYYY-MM-DD）
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          skipCount++
          continue
        }

        await db.addTransaction({
          type,
          amount,
          categoryL1,
          categoryL2,
          date,
          note: note || ''
        })
        successCount++
      }

      message.success(`导入完成！成功 ${successCount} 条${skipCount > 0 ? `，跳过 ${skipCount} 条格式不符的行` : ''}`)

      // 刷新页面以显示新数据
      window.location.reload()
    } catch (err) {
      message.error('导入失败，请检查文件格式')
    } finally {
      setImporting(false)
    }
  }

  // ====== 清空数据 ======
  /**
   * 清空前先弹确认框（防止误操作）
   * 建议用户先导出备份再清空
   */
  const handleClearData = (): void => {
    Modal.confirm({
      title: '确认清空所有数据？',
      icon: <ExclamationCircleOutlined />,
      content: '此操作不可撤销！建议先导出一份数据备份。',
      okText: '确认清空',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        setClearing(true)
        try {
          // 执行 DELETE 语句清空交易表
          await db.executeSql('DELETE FROM transactions')
          message.success('数据已清空')
          window.location.reload()
        } catch (err) {
          message.error('清空失败')
        } finally {
          setClearing(false)
        }
      }
    })
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      {/* 页面标题 */}
      <Card style={{ marginBottom: 16 }}>
        <Title level={4}>⚙️ 设置</Title>
        <Paragraph type="secondary">
          管理你的数据——导出备份、导入恢复、清空数据。
        </Paragraph>
      </Card>

      {/* ====== 数据导出 ====== */}
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Title level={5} style={{ margin: 0 }}>
              <ExportOutlined /> 导出数据
            </Title>
            <Paragraph type="secondary" style={{ marginTop: 4 }}>
              将所有账目数据导出为 CSV 文件，可以用 Excel 打开查看。建议定期导出作为备份。
            </Paragraph>
          </div>
          <Button
            type="primary"
            icon={<ExportOutlined />}
            onClick={handleExport}
            loading={exporting}
            size="large"
          >
            导出为 CSV 文件
          </Button>
        </Space>
      </Card>

      {/* ====== 数据导入 ====== */}
      <Card style={{ marginBottom: 16 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Title level={5} style={{ margin: 0 }}>
              <ImportOutlined /> 导入数据
            </Title>
            <Paragraph type="secondary" style={{ marginTop: 4 }}>
              从之前导出的 CSV 文件导入数据。CSV 文件需要包含以下列：
              <Text code>类型,金额,一级分类,二级分类,日期,备注</Text>
            </Paragraph>
            {/* 提示：导入不会覆盖已有数据 */}
            <Alert
              message="导入不会覆盖已有数据，新数据会追加到账本中。"
              type="info"
              showIcon
              style={{ marginTop: 8 }}
            />
          </div>
          <Button
            icon={<ImportOutlined />}
            onClick={handleImport}
            loading={importing}
            size="large"
          >
            从 CSV 文件导入
          </Button>
        </Space>
      </Card>

      <Divider />

      {/* ====== 清空数据（危险操作） ====== */}
      <Card style={{ borderColor: '#ff4d4f' }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div>
            <Title level={5} style={{ margin: 0, color: '#ff4d4f' }}>
              <DeleteOutlined /> 清空所有数据
            </Title>
            <Paragraph type="secondary" style={{ marginTop: 4 }}>
              删除账本中的所有记录。此操作不可撤销！
            </Paragraph>
          </div>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={handleClearData}
            loading={clearing}
            size="large"
          >
            清空全部数据
          </Button>
        </Space>
      </Card>
    </div>
  )
}
