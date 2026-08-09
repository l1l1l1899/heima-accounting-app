/** electronAPI 的类型声明 */
interface ElectronAPI {
  db: {
    queryAll(sql: string, params?: unknown[]): Promise<unknown[]>
    queryOne(sql: string, params?: unknown[]): Promise<unknown | null>
    execute(sql: string, params?: unknown[]): Promise<{ changes: number; lastInsertId: number }>
  }
  category: {
    add(params: { type: string; name: string; icon: string; parentId: number | null; sortOrder: number }): Promise<{ changes: number; lastInsertId: number }>
    update(id: number, name: string, icon: string): Promise<{ changes: number }>
    delete(id: number): Promise<{ changes: number }>
  }
  dialog: {
    saveFile(options: { defaultName: string; filters: { name: string; extensions: string[] }[] }): Promise<string | null>
    openFile(options: { filters: { name: string; extensions: string[] }[] }): Promise<string | null>
  }
  file: {
    write(filePath: string, content: string): Promise<boolean>
    read(filePath: string): Promise<string>
  }
  platform: string
  isElectron: boolean
}

interface Window {
  electronAPI: ElectronAPI
}
