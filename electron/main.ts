import { app, BrowserWindow, ipcMain, nativeTheme, protocol, net } from 'electron'
import { join } from 'path'
import { readFileSync, existsSync } from 'fs'
import { autoUpdater } from 'electron-updater'
import { DatabaseService } from './services/database'
import { DecryptService } from './services/decrypt'
import { ConfigService } from './services/config'
import { wxKeyService } from './services/wxKeyService'
import { dbPathService } from './services/dbPathService'
import { wcdbService } from './services/wcdbService'
import { dataManagementService } from './services/dataManagementService'
import { imageDecryptService } from './services/imageDecryptService'
import { imageKeyService } from './services/imageKeyService'
import { chatService } from './services/chatService'
import { analyticsService } from './services/analyticsService'
import { groupAnalyticsService } from './services/groupAnalyticsService'
import { annualReportService } from './services/annualReportService'
import { exportService, ExportOptions } from './services/exportService'
import { activationService } from './services/activationService'
import { LogService } from './services/logService'
import { videoService } from './services/videoService'

// 注册自定义协议为特权协议（必须在 app ready 之前）
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'local-video',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
])

// 配置自动更新
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = true
autoUpdater.disableDifferentialDownload = true  // 禁用差分更新，强制全量下载

/**
 * 比较两个语义化版本号
 * @param version1 版本1
 * @param version2 版本2
 * @returns version1 > version2 返回 true
 */
function isNewerVersion(version1: string, version2: string): boolean {
  const v1Parts = version1.split('.').map(Number)
  const v2Parts = version2.split('.').map(Number)
  
  // 补齐版本号位数
  const maxLength = Math.max(v1Parts.length, v2Parts.length)
  while (v1Parts.length < maxLength) v1Parts.push(0)
  while (v2Parts.length < maxLength) v2Parts.push(0)
  
  for (let i = 0; i < maxLength; i++) {
    if (v1Parts[i] > v2Parts[i]) return true
    if (v1Parts[i] < v2Parts[i]) return false
  }
  
  return false // 版本相同
}

// 单例服务
let dbService: DatabaseService | null = null
let decryptService: DecryptService | null = null
let configService: ConfigService | null = null
let logService: LogService | null = null

// 聊天窗口实例
let chatWindow: BrowserWindow | null = null
// 群聊分析窗口实例
let groupAnalyticsWindow: BrowserWindow | null = null
// 年度报告窗口实例
let annualReportWindow: BrowserWindow | null = null
// 协议窗口实例
let agreementWindow: BrowserWindow | null = null
// 购买窗口实例
let purchaseWindow: BrowserWindow | null = null

/**
 * 获取当前主题的 URL 查询参数
 * 用于子窗口加载时传递主题，防止闪烁
 */
function getThemeQueryParams(): string {
  if (!configService) return ''
  const theme = configService.get('theme') || 'cloud-dancer'
  const themeMode = configService.get('themeMode') || 'light'
  return `theme=${encodeURIComponent(theme)}&mode=${encodeURIComponent(themeMode)}`
}

function createWindow() {
  // 获取图标路径 - 打包后在 resources 目录
  const isDev = !!process.env.VITE_DEV_SERVER_URL
  const iconPath = isDev
    ? join(__dirname, '../public/icon.ico')
    : join(process.resourcesPath, 'icon.ico')

  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#1a1a1a',
      height: 40
    },
    show: false
  })

  // 初始化服务
  configService = new ConfigService()
  dbService = new DatabaseService()
  decryptService = new DecryptService()
  logService = new LogService(configService)

  // 记录应用启动日志
  logService.info('App', '应用启动', { version: app.getVersion() })

  // 窗口准备好后显示
  win.once('ready-to-show', () => {
    win.show()
  })

  // 开发环境加载 vite 服务器
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    
    // 开发环境下按 F12 或 Ctrl+Shift+I 打开开发者工具
    win.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
        if (win.webContents.isDevToolsOpened()) {
          win.webContents.closeDevTools()
        } else {
          win.webContents.openDevTools()
        }
        event.preventDefault()
      }
    })
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'))
  }

  return win
}

/**
 * 创建独立的聊天窗口（仿微信风格）
 */
function createChatWindow() {
  // 如果已存在，聚焦到现有窗口
  if (chatWindow && !chatWindow.isDestroyed()) {
    if (chatWindow.isMinimized()) {
      chatWindow.restore()
    }
    chatWindow.focus()
    return chatWindow
  }

  const isDev = !!process.env.VITE_DEV_SERVER_URL
  const iconPath = isDev
    ? join(__dirname, '../public/icon.ico')
    : join(process.resourcesPath, 'icon.ico')

  const isDark = nativeTheme.shouldUseDarkColors

  chatWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#666666',
      height: 32
    },
    show: false,
    backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0'
  })

  chatWindow.once('ready-to-show', () => {
    chatWindow?.show()
  })

  // 获取主题参数
  const themeParams = getThemeQueryParams()

  // 加载聊天页面
  if (process.env.VITE_DEV_SERVER_URL) {
    chatWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}?${themeParams}#/chat-window`)
    
    chatWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
        if (chatWindow?.webContents.isDevToolsOpened()) {
          chatWindow.webContents.closeDevTools()
        } else {
          chatWindow?.webContents.openDevTools()
        }
        event.preventDefault()
      }
    })
  } else {
    chatWindow.loadFile(join(__dirname, '../dist/index.html'), { 
      hash: '/chat-window',
      query: { theme: configService?.get('theme') || 'cloud-dancer', mode: configService?.get('themeMode') || 'light' }
    })
  }

  chatWindow.on('closed', () => {
    chatWindow = null
  })

  return chatWindow
}

/**
 * 创建独立的群聊分析窗口
 */
function createGroupAnalyticsWindow() {
  // 如果已存在，聚焦到现有窗口
  if (groupAnalyticsWindow && !groupAnalyticsWindow.isDestroyed()) {
    if (groupAnalyticsWindow.isMinimized()) {
      groupAnalyticsWindow.restore()
    }
    groupAnalyticsWindow.focus()
    return groupAnalyticsWindow
  }

  const isDev = !!process.env.VITE_DEV_SERVER_URL
  const iconPath = isDev
    ? join(__dirname, '../public/icon.ico')
    : join(process.resourcesPath, 'icon.ico')

  const isDark = nativeTheme.shouldUseDarkColors

  groupAnalyticsWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 900,
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: '#666666',
      height: 32
    },
    show: false,
    backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0'
  })

  groupAnalyticsWindow.once('ready-to-show', () => {
    groupAnalyticsWindow?.show()
  })

  // 获取主题参数
  const themeParams = getThemeQueryParams()

  // 加载群聊分析页面
  if (process.env.VITE_DEV_SERVER_URL) {
    groupAnalyticsWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}?${themeParams}#/group-analytics-window`)
    
    groupAnalyticsWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
        if (groupAnalyticsWindow?.webContents.isDevToolsOpened()) {
          groupAnalyticsWindow.webContents.closeDevTools()
        } else {
          groupAnalyticsWindow?.webContents.openDevTools()
        }
        event.preventDefault()
      }
    })
  } else {
    groupAnalyticsWindow.loadFile(join(__dirname, '../dist/index.html'), { 
      hash: '/group-analytics-window',
      query: { theme: configService?.get('theme') || 'cloud-dancer', mode: configService?.get('themeMode') || 'light' }
    })
  }

  groupAnalyticsWindow.on('closed', () => {
    groupAnalyticsWindow = null
  })

  return groupAnalyticsWindow
}

/**
 * 创建独立的年度报告窗口
 */
function createAnnualReportWindow(year: number) {
  // 如果已存在，关闭旧窗口
  if (annualReportWindow && !annualReportWindow.isDestroyed()) {
    annualReportWindow.close()
    annualReportWindow = null
  }

  const isDev = !!process.env.VITE_DEV_SERVER_URL
  const iconPath = isDev
    ? join(__dirname, '../public/icon.ico')
    : join(process.resourcesPath, 'icon.ico')

  const isDark = nativeTheme.shouldUseDarkColors

  annualReportWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 650,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: isDark ? '#FFFFFF' : '#333333',
      height: 32
    },
    show: false,
    backgroundColor: isDark ? '#1A1A1A' : '#F9F8F6'
  })

  annualReportWindow.once('ready-to-show', () => {
    annualReportWindow?.show()
  })

  // 获取主题参数
  const themeParams = getThemeQueryParams()

  // 加载年度报告页面，带年份参数
  if (process.env.VITE_DEV_SERVER_URL) {
    annualReportWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}?${themeParams}#/annual-report-window?year=${year}`)
    
    annualReportWindow.webContents.on('before-input-event', (event, input) => {
      if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
        if (annualReportWindow?.webContents.isDevToolsOpened()) {
          annualReportWindow.webContents.closeDevTools()
        } else {
          annualReportWindow?.webContents.openDevTools()
        }
        event.preventDefault()
      }
    })
  } else {
    annualReportWindow.loadFile(join(__dirname, '../dist/index.html'), { 
      hash: `/annual-report-window?year=${year}`,
      query: { theme: configService?.get('theme') || 'cloud-dancer', mode: configService?.get('themeMode') || 'light' }
    })
  }

  annualReportWindow.on('closed', () => {
    annualReportWindow = null
  })

  return annualReportWindow
}

/**
 * 创建用户协议窗口
 */
function createAgreementWindow() {
  // 如果已存在，聚焦
  if (agreementWindow && !agreementWindow.isDestroyed()) {
    agreementWindow.focus()
    return agreementWindow
  }

  const isDev = !!process.env.VITE_DEV_SERVER_URL
  const iconPath = isDev
    ? join(__dirname, '../public/icon.ico')
    : join(process.resourcesPath, 'icon.ico')

  const isDark = nativeTheme.shouldUseDarkColors

  agreementWindow = new BrowserWindow({
    width: 800,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#00000000',
      symbolColor: isDark ? '#FFFFFF' : '#333333',
      height: 32
    },
    show: false,
    backgroundColor: isDark ? '#1A1A1A' : '#FFFFFF'
  })

  agreementWindow.once('ready-to-show', () => {
    agreementWindow?.show()
  })

  // 获取主题参数
  const themeParams = getThemeQueryParams()

  if (process.env.VITE_DEV_SERVER_URL) {
    agreementWindow.loadURL(`${process.env.VITE_DEV_SERVER_URL}?${themeParams}#/agreement-window`)
  } else {
    agreementWindow.loadFile(join(__dirname, '../dist/index.html'), { 
      hash: '/agreement-window',
      query: { theme: configService?.get('theme') || 'cloud-dancer', mode: configService?.get('themeMode') || 'light' }
    })
  }

  agreementWindow.on('closed', () => {
    agreementWindow = null
  })

  return agreementWindow
}

/**
 * 创建购买窗口
 */
function createPurchaseWindow() {
  // 如果已存在，聚焦
  if (purchaseWindow && !purchaseWindow.isDestroyed()) {
    purchaseWindow.focus()
    return purchaseWindow
  }

  const isDev = !!process.env.VITE_DEV_SERVER_URL
  const iconPath = isDev
    ? join(__dirname, '../public/icon.ico')
    : join(process.resourcesPath, 'icon.ico')

  purchaseWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 800,
    minHeight: 600,
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    },
    title: '获取激活码 - 密语',
    show: false,
    backgroundColor: '#FFFFFF',
    autoHideMenuBar: true
  })

  purchaseWindow.once('ready-to-show', () => {
    purchaseWindow?.show()
  })

  // 加载购买页面
  purchaseWindow.loadURL('https://pay.ldxp.cn/shop/aiqiji')

  purchaseWindow.on('closed', () => {
    purchaseWindow = null
  })

  return purchaseWindow
}

// 注册 IPC 处理器
function registerIpcHandlers() {
  // 配置相关
  ipcMain.handle('config:get', async (_, key: string) => {
    return configService?.get(key as any)
  })

  ipcMain.handle('config:set', async (_, key: string, value: any) => {
    return configService?.set(key as any, value)
  })

  // TLD 缓存相关
  ipcMain.handle('config:getTldCache', async () => {
    return configService?.getTldCache()
  })

  ipcMain.handle('config:setTldCache', async (_, tlds: string[]) => {
    return configService?.setTldCache(tlds)
  })

  // 数据库相关
  ipcMain.handle('db:open', async (_, dbPath: string) => {
    return dbService?.open(dbPath)
  })

  ipcMain.handle('db:query', async (_, sql: string, params?: any[]) => {
    return dbService?.query(sql, params)
  })

  ipcMain.handle('db:close', async () => {
    return dbService?.close()
  })

  // 解密相关
  ipcMain.handle('decrypt:database', async (_, sourcePath: string, key: string, outputPath: string) => {
    return decryptService?.decryptDatabase(sourcePath, key, outputPath)
  })

  ipcMain.handle('decrypt:image', async (_, imagePath: string) => {
    return decryptService?.decryptImage(imagePath)
  })

  // 文件对话框
  ipcMain.handle('dialog:openFile', async (_, options) => {
    const { dialog } = await import('electron')
    return dialog.showOpenDialog(options)
  })

  ipcMain.handle('dialog:saveFile', async (_, options) => {
    const { dialog } = await import('electron')
    return dialog.showSaveDialog(options)
  })

  ipcMain.handle('shell:openPath', async (_, path: string) => {
    const { shell } = await import('electron')
    return shell.openPath(path)
  })

  ipcMain.handle('shell:openExternal', async (_, url: string) => {
    const { shell } = await import('electron')
    return shell.openExternal(url)
  })

  ipcMain.handle('app:getDownloadsPath', async () => {
    return app.getPath('downloads')
  })

  ipcMain.handle('app:getVersion', async () => {
    return app.getVersion()
  })

  ipcMain.handle('app:checkForUpdates', async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      if (result && result.updateInfo) {
        const currentVersion = app.getVersion()
        const latestVersion = result.updateInfo.version
        
        // 使用语义化版本比较
        if (isNewerVersion(latestVersion, currentVersion)) {
          return {
            hasUpdate: true,
            version: latestVersion,
            releaseNotes: result.updateInfo.releaseNotes as string || ''
          }
        }
      }
      return { hasUpdate: false }
    } catch (error) {
      console.error('检查更新失败:', error)
      return { hasUpdate: false }
    }
  })

  ipcMain.handle('app:downloadAndInstall', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    
    // 监听下载进度
    autoUpdater.on('download-progress', (progress) => {
      win?.webContents.send('app:downloadProgress', progress.percent)
    })

    // 下载完成后自动安装
    autoUpdater.on('update-downloaded', () => {
      autoUpdater.quitAndInstall(false, true)
    })

    try {
      await autoUpdater.downloadUpdate()
    } catch (error) {
      console.error('下载更新失败:', error)
      throw error
    }
  })

  // 窗口控制
  ipcMain.on('window:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  ipcMain.on('window:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) {
      win.unmaximize()
    } else {
      win?.maximize()
    }
  })

  ipcMain.on('window:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  // 更新窗口控件主题色
  ipcMain.on('window:setTitleBarOverlay', (event, options: { symbolColor: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      win.setTitleBarOverlay({
        color: '#00000000',
        symbolColor: options.symbolColor,
        height: 40
      })
    }
  })

  // 密钥获取相关
  ipcMain.handle('wxkey:isWeChatRunning', async () => {
    return wxKeyService.isWeChatRunning()
  })

  ipcMain.handle('wxkey:getWeChatPid', async () => {
    return wxKeyService.getWeChatPid()
  })

  ipcMain.handle('wxkey:killWeChat', async () => {
    return wxKeyService.killWeChat()
  })

  ipcMain.handle('wxkey:launchWeChat', async () => {
    return wxKeyService.launchWeChat()
  })

  ipcMain.handle('wxkey:waitForWindow', async (_, maxWaitSeconds?: number) => {
    return wxKeyService.waitForWeChatWindow(maxWaitSeconds)
  })

  ipcMain.handle('wxkey:startGetKey', async (event) => {
    logService?.info('WxKey', '开始获取微信密钥')
    try {
      // 初始化 DLL
      const initSuccess = await wxKeyService.initialize()
      if (!initSuccess) {
        logService?.error('WxKey', 'DLL 初始化失败')
        return { success: false, error: 'DLL 初始化失败' }
      }

      // 获取微信 PID
      const pid = wxKeyService.getWeChatPid()
      if (!pid) {
        logService?.error('WxKey', '未找到微信进程')
        return { success: false, error: '未找到微信进程' }
      }

      logService?.info('WxKey', '找到微信进程', { pid })

      // 创建 Promise 等待密钥
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          wxKeyService.dispose()
          logService?.error('WxKey', '获取密钥超时')
          resolve({ success: false, error: '获取密钥超时' })
        }, 60000)

        const success = wxKeyService.installHook(
          pid,
          (key) => {
            clearTimeout(timeout)
            wxKeyService.dispose()
            logService?.info('WxKey', '密钥获取成功', { keyLength: key.length })
            resolve({ success: true, key })
          },
          (status, level) => {
            // 发送状态到渲染进程
            event.sender.send('wxkey:status', { status, level })
          }
        )

        if (!success) {
          clearTimeout(timeout)
          const error = wxKeyService.getLastError()
          wxKeyService.dispose()
          logService?.error('WxKey', 'Hook 安装失败', { error })
          resolve({ success: false, error: `Hook 安装失败: ${error}` })
        }
      })
    } catch (e) {
      wxKeyService.dispose()
      logService?.error('WxKey', '获取密钥异常', { error: String(e) })
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('wxkey:cancel', async () => {
    wxKeyService.dispose()
    return true
  })

  ipcMain.handle('wxkey:detectCurrentAccount', async (_, dbPath?: string, maxTimeDiffMinutes?: number) => {
    return wxKeyService.detectCurrentAccount(dbPath, maxTimeDiffMinutes)
  })

  // 数据库路径相关
  ipcMain.handle('dbpath:autoDetect', async () => {
    return dbPathService.autoDetect()
  })

  ipcMain.handle('dbpath:scanWxids', async (_, rootPath: string) => {
    return dbPathService.scanWxids(rootPath)
  })

  ipcMain.handle('dbpath:getDefault', async () => {
    return dbPathService.getDefaultPath()
  })

  // WCDB 数据库相关
  ipcMain.handle('wcdb:testConnection', async (_, dbPath: string, hexKey: string, wxid: string, isAutoConnect = false) => {
    const logPrefix = isAutoConnect ? '自动连接' : '手动测试'
    logService?.info('WCDB', `${logPrefix}数据库连接`, { dbPath, wxid, isAutoConnect })
    const result = await wcdbService.testConnection(dbPath, hexKey, wxid)
    if (result.success) {
      logService?.info('WCDB', `${logPrefix}数据库连接成功`, { sessionCount: result.sessionCount })
    } else {
      // 自动连接失败使用WARN级别，手动测试失败使用ERROR级别
      const logLevel = isAutoConnect ? 'warn' : 'error'
      const errorInfo = {
        error: result.error || '未知错误',
        dbPath,
        wxid,
        keyLength: hexKey ? hexKey.length : 0,
        isAutoConnect
      }
      
      if (logLevel === 'warn') {
        logService?.warn('WCDB', `${logPrefix}数据库连接失败`, errorInfo)
      } else {
        logService?.error('WCDB', `${logPrefix}数据库连接失败`, errorInfo)
      }
    }
    return result
  })

  ipcMain.handle('wcdb:open', async (_, dbPath: string, hexKey: string, wxid: string) => {
    return wcdbService.open(dbPath, hexKey, wxid)
  })

  ipcMain.handle('wcdb:close', async () => {
    wcdbService.close()
    return true
  })

  // 数据管理相关
  ipcMain.handle('dataManagement:scanDatabases', async () => {
    return dataManagementService.scanDatabases()
  })

  ipcMain.handle('dataManagement:decryptAll', async () => {
    return dataManagementService.decryptAll()
  })

  ipcMain.handle('dataManagement:incrementalUpdate', async () => {
    return dataManagementService.incrementalUpdate()
  })

  ipcMain.handle('dataManagement:getCurrentCachePath', async () => {
    return dataManagementService.getCurrentCachePath()
  })

  ipcMain.handle('dataManagement:getDefaultCachePath', async () => {
    return dataManagementService.getDefaultCachePath()
  })

  ipcMain.handle('dataManagement:migrateCache', async (_, newCachePath: string) => {
    return dataManagementService.migrateCache(newCachePath)
  })

  ipcMain.handle('dataManagement:scanImages', async (_, dirPath: string) => {
    return dataManagementService.scanImages(dirPath)
  })

  ipcMain.handle('dataManagement:decryptImages', async (_, dirPath: string) => {
    return dataManagementService.decryptImages(dirPath)
  })

  ipcMain.handle('dataManagement:getImageDirectories', async () => {
    return dataManagementService.getImageDirectories()
  })

  ipcMain.handle('dataManagement:decryptSingleImage', async (_, filePath: string) => {
    return dataManagementService.decryptSingleImage(filePath)
  })

  // 图片解密相关
  ipcMain.handle('imageDecrypt:batchDetectXorKey', async (_, dirPath: string) => {
    try {
      const key = await imageDecryptService.batchDetectXorKey(dirPath)
      return { success: true, key }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('imageDecrypt:decryptImage', async (_, inputPath: string, outputPath: string, xorKey: number, aesKey?: string) => {
    try {
      logService?.info('ImageDecrypt', '开始解密图片', { inputPath, outputPath })
      const aesKeyBuffer = aesKey ? imageDecryptService.asciiKey16(aesKey) : undefined
      await imageDecryptService.decryptToFile(inputPath, outputPath, xorKey, aesKeyBuffer)
      logService?.info('ImageDecrypt', '图片解密成功', { outputPath })
      return { success: true }
    } catch (e) {
      logService?.error('ImageDecrypt', '图片解密失败', { inputPath, error: String(e) })
      return { success: false, error: String(e) }
    }
  })

  // 新的图片解密 API（来自 WeFlow）
  ipcMain.handle('image:decrypt', async (_, payload: { sessionId?: string; imageMd5?: string; imageDatName?: string; force?: boolean }) => {
    const result = await imageDecryptService.decryptImage(payload)
    if (!result.success) {
      logService?.error('ImageDecrypt', '图片解密失败', { payload, error: result.error })
    }
    return result
  })

  ipcMain.handle('image:resolveCache', async (_, payload: { sessionId?: string; imageMd5?: string; imageDatName?: string }) => {
    const result = await imageDecryptService.resolveCachedImage(payload)
    if (!result.success) {
      logService?.warn('ImageDecrypt', '图片缓存解析失败', { payload, error: result.error })
    }
    return result
  })

  // 视频相关
  ipcMain.handle('video:getVideoInfo', async (_, videoMd5: string) => {
    try {
      const result = videoService.getVideoInfo(videoMd5)
      return { success: true, ...result }
    } catch (e) {
      return { success: false, error: String(e), exists: false }
    }
  })

  ipcMain.handle('video:readFile', async (_, videoPath: string) => {
    try {
      if (!existsSync(videoPath)) {
        return { success: false, error: '视频文件不存在' }
      }
      const buffer = readFileSync(videoPath)
      const base64 = buffer.toString('base64')
      return { success: true, data: `data:video/mp4;base64,${base64}` }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('video:parseVideoMd5', async (_, content: string) => {
    try {
      const md5 = videoService.parseVideoMd5(content)
      return { success: true, md5 }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // 图片密钥获取（从内存）
  ipcMain.handle('imageKey:getImageKeys', async (event, userDir: string) => {
    logService?.info('ImageKey', '开始获取图片密钥', { userDir })
    try {
      // 获取微信 PID
      const pid = wxKeyService.getWeChatPid()
      if (!pid) {
        logService?.error('ImageKey', '微信进程未运行')
        return { success: false, error: '微信进程未运行，请先启动微信并登录' }
      }

      const result = await imageKeyService.getImageKeys(
        userDir,
        pid,
        (msg) => {
          event.sender.send('imageKey:progress', msg)
        }
      )

      if (result.success) {
        logService?.info('ImageKey', '图片密钥获取成功', { 
          hasXorKey: result.xorKey !== undefined,
          hasAesKey: !!result.aesKey 
        })
      } else {
        logService?.error('ImageKey', '图片密钥获取失败', { error: result.error })
      }

      return result
    } catch (e) {
      logService?.error('ImageKey', '图片密钥获取异常', { error: String(e) })
      return { success: false, error: String(e) }
    }
  })

  // 聊天相关
  ipcMain.handle('chat:connect', async () => {
    logService?.info('Chat', '尝试连接聊天服务')
    const result = await chatService.connect()
    if (result.success) {
      logService?.info('Chat', '聊天服务连接成功')
    } else {
      // 聊天连接失败可能是数据库未准备好，使用WARN级别
      logService?.warn('Chat', '聊天服务连接失败', { error: result.error })
    }
    return result
  })

  ipcMain.handle('chat:getSessions', async () => {
    const result = await chatService.getSessions()
    if (!result.success) {
      // 获取会话失败可能是数据库未连接，使用WARN级别
      logService?.warn('Chat', '获取会话列表失败', { error: result.error })
    }
    return result
  })

  ipcMain.handle('chat:getMessages', async (_, sessionId: string, offset?: number, limit?: number) => {
    const result = await chatService.getMessages(sessionId, offset, limit)
    if (!result.success) {
      // 获取消息失败可能是数据库未连接，使用WARN级别
      logService?.warn('Chat', '获取消息失败', { sessionId, error: result.error })
    }
    return result
  })

  ipcMain.handle('chat:getContact', async (_, username: string) => {
    return chatService.getContact(username)
  })

  ipcMain.handle('chat:getContactAvatar', async (_, username: string) => {
    return chatService.getContactAvatar(username)
  })

  ipcMain.handle('chat:getMyAvatarUrl', async () => {
    const result = chatService.getMyAvatarUrl()
    // 首页会调用这个接口，失败是正常的，不记录错误日志
    return result
  })

  ipcMain.handle('chat:getMyUserInfo', async () => {
    const result = chatService.getMyUserInfo()
    // 首页会调用这个接口，失败是正常的，不记录错误日志
    return result
  })

  ipcMain.handle('chat:downloadEmoji', async (_, cdnUrl: string, md5?: string) => {
    const result = await chatService.downloadEmoji(cdnUrl, md5)
    if (!result.success) {
      logService?.warn('Chat', '下载表情失败', { cdnUrl, error: result.error })
    }
    return result
  })

  ipcMain.handle('chat:close', async () => {
    logService?.info('Chat', '关闭聊天服务')
    chatService.close()
    return true
  })

  ipcMain.handle('chat:refreshCache', async () => {
    logService?.info('Chat', '刷新消息缓存')
    chatService.refreshMessageDbCache()
    return true
  })

  ipcMain.handle('chat:getSessionDetail', async (_, sessionId: string) => {
    const result = await chatService.getSessionDetail(sessionId)
    if (!result.success) {
      // 获取会话详情失败可能是数据库未连接，使用WARN级别
      logService?.warn('Chat', '获取会话详情失败', { sessionId, error: result.error })
    }
    return result
  })

  // 导出相关
  ipcMain.handle('export:exportSessions', async (_, sessionIds: string[], outputDir: string, options: ExportOptions) => {
    return exportService.exportSessions(sessionIds, outputDir, options)
  })

  ipcMain.handle('export:exportSession', async (_, sessionId: string, outputPath: string, options: ExportOptions) => {
    return exportService.exportSessionToChatLab(sessionId, outputPath, options)
  })

  // 数据分析相关
  ipcMain.handle('analytics:getOverallStatistics', async () => {
    return analyticsService.getOverallStatistics()
  })

  ipcMain.handle('analytics:getContactRankings', async (_, limit?: number) => {
    return analyticsService.getContactRankings(limit)
  })

  ipcMain.handle('analytics:getTimeDistribution', async () => {
    return analyticsService.getTimeDistribution()
  })

  // 群聊分析相关
  ipcMain.handle('groupAnalytics:getGroupChats', async () => {
    return groupAnalyticsService.getGroupChats()
  })

  ipcMain.handle('groupAnalytics:getGroupMembers', async (_, chatroomId: string) => {
    return groupAnalyticsService.getGroupMembers(chatroomId)
  })

  ipcMain.handle('groupAnalytics:getGroupMessageRanking', async (_, chatroomId: string, limit?: number, startTime?: number, endTime?: number) => {
    return groupAnalyticsService.getGroupMessageRanking(chatroomId, limit, startTime, endTime)
  })

  ipcMain.handle('groupAnalytics:getGroupActiveHours', async (_, chatroomId: string, startTime?: number, endTime?: number) => {
    return groupAnalyticsService.getGroupActiveHours(chatroomId, startTime, endTime)
  })

  ipcMain.handle('groupAnalytics:getGroupMediaStats', async (_, chatroomId: string, startTime?: number, endTime?: number) => {
    return groupAnalyticsService.getGroupMediaStats(chatroomId, startTime, endTime)
  })

  // 打开独立聊天窗口
  ipcMain.handle('window:openChatWindow', async () => {
    createChatWindow()
    return true
  })

  // 打开群聊分析窗口
  ipcMain.handle('window:openGroupAnalyticsWindow', async () => {
    createGroupAnalyticsWindow()
    return true
  })

  // 打开年度报告窗口
  ipcMain.handle('window:openAnnualReportWindow', async (_, year: number) => {
    createAnnualReportWindow(year)
    return true
  })

  // 打开协议窗口
  ipcMain.handle('window:openAgreementWindow', async () => {
    createAgreementWindow()
    return true
  })

  // 打开购买窗口
  ipcMain.handle('window:openPurchaseWindow', async () => {
    createPurchaseWindow()
    return true
  })

  // 年度报告相关
  ipcMain.handle('annualReport:getAvailableYears', async () => {
    return annualReportService.getAvailableYears()
  })

  ipcMain.handle('annualReport:generateReport', async (_, year: number) => {
    return annualReportService.generateReport(year)
  })

  // 检查聊天窗口是否打开
  ipcMain.handle('window:isChatWindowOpen', async () => {
    return chatWindow !== null && !chatWindow.isDestroyed()
  })

  // 关闭聊天窗口
  ipcMain.handle('window:closeChatWindow', async () => {
    if (chatWindow && !chatWindow.isDestroyed()) {
      chatWindow.close()
      chatWindow = null
    }
    return true
  })

  // 激活相关
  ipcMain.handle('activation:getDeviceId', async () => {
    return activationService.getDeviceId()
  })

  ipcMain.handle('activation:verifyCode', async (_, code: string) => {
    return activationService.verifyCode(code)
  })

  ipcMain.handle('activation:activate', async (_, code: string) => {
    return activationService.activate(code)
  })

  ipcMain.handle('activation:checkStatus', async () => {
    return activationService.checkActivation()
  })

  ipcMain.handle('activation:getTypeDisplayName', async (_, type: string | null) => {
    return activationService.getTypeDisplayName(type)
  })

  ipcMain.handle('activation:clearCache', async () => {
    activationService.clearCache()
    return true
  })

  // 缓存管理
  ipcMain.handle('cache:clearImages', async () => {
    logService?.info('Cache', '开始清除图片缓存')
    try {
      const cacheService = new (await import('./services/cacheService')).CacheService(configService!)
      const result = await cacheService.clearImages()
      if (result.success) {
        logService?.info('Cache', '图片缓存清除成功')
      } else {
        logService?.error('Cache', '图片缓存清除失败', { error: result.error })
      }
      return result
    } catch (e) {
      logService?.error('Cache', '图片缓存清除异常', { error: String(e) })
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('cache:clearAll', async () => {
    logService?.info('Cache', '开始清除所有缓存')
    try {
      const cacheService = new (await import('./services/cacheService')).CacheService(configService!)
      const result = await cacheService.clearAll()
      if (result.success) {
        logService?.info('Cache', '所有缓存清除成功')
      } else {
        logService?.error('Cache', '所有缓存清除失败', { error: result.error })
      }
      return result
    } catch (e) {
      logService?.error('Cache', '所有缓存清除异常', { error: String(e) })
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('cache:clearConfig', async () => {
    logService?.info('Cache', '开始清除配置')
    try {
      const cacheService = new (await import('./services/cacheService')).CacheService(configService!)
      const result = await cacheService.clearConfig()
      if (result.success) {
        logService?.info('Cache', '配置清除成功')
      } else {
        logService?.error('Cache', '配置清除失败', { error: result.error })
      }
      return result
    } catch (e) {
      logService?.error('Cache', '配置清除异常', { error: String(e) })
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('cache:getCacheSize', async () => {
    try {
      const cacheService = new (await import('./services/cacheService')).CacheService(configService!)
      return await cacheService.getCacheSize()
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  // 日志管理
  ipcMain.handle('log:getLogFiles', async () => {
    try {
      return { success: true, files: logService?.getLogFiles() || [] }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('log:readLogFile', async (_, filename: string) => {
    try {
      const content = logService?.readLogFile(filename)
      return { success: true, content }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('log:clearLogs', async () => {
    try {
      return logService?.clearLogs() || { success: false, error: '日志服务未初始化' }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('log:getLogSize', async () => {
    try {
      const size = logService?.getLogSize() || 0
      return { success: true, size }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('log:getLogDirectory', async () => {
    try {
      const directory = logService?.getLogDirectory() || ''
      return { success: true, directory }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('log:setLogLevel', async (_, level: string) => {
    try {
      if (!logService) {
        return { success: false, error: '日志服务未初始化' }
      }
      
      let logLevel: number
      switch (level.toUpperCase()) {
        case 'DEBUG':
          logLevel = 0
          break
        case 'INFO':
          logLevel = 1
          break
        case 'WARN':
          logLevel = 2
          break
        case 'ERROR':
          logLevel = 3
          break
        default:
          return { success: false, error: '无效的日志级别' }
      }
      
      logService.setLogLevel(logLevel)
      return { success: true }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })

  ipcMain.handle('log:getLogLevel', async () => {
    try {
      if (!logService) {
        return { success: false, error: '日志服务未初始化' }
      }
      
      const level = logService.getLogLevel()
      const levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR']
      return { success: true, level: levelNames[level] }
    } catch (e) {
      return { success: false, error: String(e) }
    }
  })
}

// 主窗口引用
let mainWindow: BrowserWindow | null = null

// 启动时自动检测更新
function checkForUpdatesOnStartup() {
  // 开发环境不检测更新
  if (process.env.VITE_DEV_SERVER_URL) return

  // 延迟3秒检测，等待窗口完全加载
  setTimeout(async () => {
    try {
      const result = await autoUpdater.checkForUpdates()
      if (result && result.updateInfo) {
        const currentVersion = app.getVersion()
        const latestVersion = result.updateInfo.version
        
        // 使用语义化版本比较
        if (isNewerVersion(latestVersion, currentVersion) && mainWindow) {
          // 通知渲染进程有新版本
          mainWindow.webContents.send('app:updateAvailable', {
            version: latestVersion,
            releaseNotes: result.updateInfo.releaseNotes || ''
          })
        }
      }
    } catch (error) {
      console.error('启动时检查更新失败:', error)
    }
  }, 3000)
}

app.whenReady().then(() => {
  // 注册自定义协议用于加载本地视频
  protocol.handle('local-video', (request) => {
    // 移除协议前缀并解码
    let filePath = decodeURIComponent(request.url.replace('local-video://', ''))
    // Windows 路径处理：确保使用正斜杠
    filePath = filePath.replace(/\\/g, '/')
    console.log('[Protocol] 加载视频:', filePath)
    return net.fetch(`file:///${filePath}`)
  })
  
  registerIpcHandlers()
  mainWindow = createWindow()
  
  // 启动时检测更新
  checkForUpdatesOnStartup()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  // 关闭配置数据库连接
  configService?.close()
})
