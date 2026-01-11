import { contextBridge, ipcRenderer } from 'electron'

// 暴露给渲染进程的 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 配置
  config: {
    get: (key: string) => ipcRenderer.invoke('config:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('config:set', key, value),
    getTldCache: () => ipcRenderer.invoke('config:getTldCache'),
    setTldCache: (tlds: string[]) => ipcRenderer.invoke('config:setTldCache', tlds)
  },

  // 数据库操作
  db: {
    open: (dbPath: string, key?: string) => ipcRenderer.invoke('db:open', dbPath, key),
    query: (sql: string, params?: any[]) => ipcRenderer.invoke('db:query', sql, params),
    close: () => ipcRenderer.invoke('db:close')
  },

  // 解密
  decrypt: {
    database: (sourcePath: string, key: string, outputPath: string) =>
      ipcRenderer.invoke('decrypt:database', sourcePath, key, outputPath),
    image: (imagePath: string) => ipcRenderer.invoke('decrypt:image', imagePath)
  },

  // 对话框
  dialog: {
    openFile: (options: any) => ipcRenderer.invoke('dialog:openFile', options),
    saveFile: (options: any) => ipcRenderer.invoke('dialog:saveFile', options)
  },

  // Shell
  shell: {
    openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path),
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url)
  },

  // App
  app: {
    getDownloadsPath: () => ipcRenderer.invoke('app:getDownloadsPath'),
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    checkForUpdates: () => ipcRenderer.invoke('app:checkForUpdates'),
    downloadAndInstall: () => ipcRenderer.invoke('app:downloadAndInstall'),
    onDownloadProgress: (callback: (progress: number) => void) => {
      ipcRenderer.on('app:downloadProgress', (_, progress) => callback(progress))
      return () => ipcRenderer.removeAllListeners('app:downloadProgress')
    },
    onUpdateAvailable: (callback: (info: { version: string; releaseNotes: string }) => void) => {
      ipcRenderer.on('app:updateAvailable', (_, info) => callback(info))
      return () => ipcRenderer.removeAllListeners('app:updateAvailable')
    }
  },

  // 窗口控制
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    openChatWindow: () => ipcRenderer.invoke('window:openChatWindow'),
    openGroupAnalyticsWindow: () => ipcRenderer.invoke('window:openGroupAnalyticsWindow'),
    openAnnualReportWindow: (year: number) => ipcRenderer.invoke('window:openAnnualReportWindow', year),
    openAgreementWindow: () => ipcRenderer.invoke('window:openAgreementWindow'),
    openPurchaseWindow: () => ipcRenderer.invoke('window:openPurchaseWindow'),
    isChatWindowOpen: () => ipcRenderer.invoke('window:isChatWindowOpen'),
    closeChatWindow: () => ipcRenderer.invoke('window:closeChatWindow'),
    setTitleBarOverlay: (options: { symbolColor: string }) => ipcRenderer.send('window:setTitleBarOverlay', options)
  },

  // 密钥获取
  wxKey: {
    isWeChatRunning: () => ipcRenderer.invoke('wxkey:isWeChatRunning'),
    getWeChatPid: () => ipcRenderer.invoke('wxkey:getWeChatPid'),
    killWeChat: () => ipcRenderer.invoke('wxkey:killWeChat'),
    launchWeChat: () => ipcRenderer.invoke('wxkey:launchWeChat'),
    waitForWindow: (maxWaitSeconds?: number) => ipcRenderer.invoke('wxkey:waitForWindow', maxWaitSeconds),
    startGetKey: () => ipcRenderer.invoke('wxkey:startGetKey'),
    cancel: () => ipcRenderer.invoke('wxkey:cancel'),
    detectCurrentAccount: (dbPath?: string, maxTimeDiffMinutes?: number) => ipcRenderer.invoke('wxkey:detectCurrentAccount', dbPath, maxTimeDiffMinutes),
    onStatus: (callback: (data: { status: string; level: number }) => void) => {
      ipcRenderer.on('wxkey:status', (_, data) => callback(data))
      return () => ipcRenderer.removeAllListeners('wxkey:status')
    }
  },

  // 数据库路径
  dbPath: {
    autoDetect: () => ipcRenderer.invoke('dbpath:autoDetect'),
    scanWxids: (rootPath: string) => ipcRenderer.invoke('dbpath:scanWxids', rootPath),
    getDefault: () => ipcRenderer.invoke('dbpath:getDefault')
  },

  // WCDB 数据库
  wcdb: {
    testConnection: (dbPath: string, hexKey: string, wxid: string, isAutoConnect?: boolean) => 
      ipcRenderer.invoke('wcdb:testConnection', dbPath, hexKey, wxid, isAutoConnect),
    open: (dbPath: string, hexKey: string, wxid: string) => 
      ipcRenderer.invoke('wcdb:open', dbPath, hexKey, wxid),
    close: () => ipcRenderer.invoke('wcdb:close')
  },

  // 数据管理
  dataManagement: {
    scanDatabases: () => ipcRenderer.invoke('dataManagement:scanDatabases'),
    decryptAll: () => ipcRenderer.invoke('dataManagement:decryptAll'),
    incrementalUpdate: () => ipcRenderer.invoke('dataManagement:incrementalUpdate'),
    getCurrentCachePath: () => ipcRenderer.invoke('dataManagement:getCurrentCachePath'),
    getDefaultCachePath: () => ipcRenderer.invoke('dataManagement:getDefaultCachePath'),
    migrateCache: (newCachePath: string) => ipcRenderer.invoke('dataManagement:migrateCache', newCachePath),
    scanImages: (dirPath: string) => ipcRenderer.invoke('dataManagement:scanImages', dirPath),
    decryptImages: (dirPath: string) => ipcRenderer.invoke('dataManagement:decryptImages', dirPath),
    getImageDirectories: () => ipcRenderer.invoke('dataManagement:getImageDirectories'),
    decryptSingleImage: (filePath: string) => ipcRenderer.invoke('dataManagement:decryptSingleImage', filePath),
    onProgress: (callback: (data: any) => void) => {
      ipcRenderer.on('dataManagement:progress', (_, data) => callback(data))
      return () => ipcRenderer.removeAllListeners('dataManagement:progress')
    }
  },

  // 图片解密
  imageDecrypt: {
    batchDetectXorKey: (dirPath: string) => ipcRenderer.invoke('imageDecrypt:batchDetectXorKey', dirPath),
    decryptImage: (inputPath: string, outputPath: string, xorKey: number, aesKey?: string) => 
      ipcRenderer.invoke('imageDecrypt:decryptImage', inputPath, outputPath, xorKey, aesKey)
  },

  // 图片解密（新 API）
  image: {
    decrypt: (payload: { sessionId?: string; imageMd5?: string; imageDatName?: string; force?: boolean }) => 
      ipcRenderer.invoke('image:decrypt', payload),
    resolveCache: (payload: { sessionId?: string; imageMd5?: string; imageDatName?: string }) => 
      ipcRenderer.invoke('image:resolveCache', payload),
    onUpdateAvailable: (callback: (data: { cacheKey: string; imageMd5?: string; imageDatName?: string }) => void) => {
      ipcRenderer.on('image:updateAvailable', (_, data) => callback(data))
      return () => ipcRenderer.removeAllListeners('image:updateAvailable')
    },
    onCacheResolved: (callback: (data: { cacheKey: string; imageMd5?: string; imageDatName?: string; localPath: string }) => void) => {
      ipcRenderer.on('image:cacheResolved', (_, data) => callback(data))
      return () => ipcRenderer.removeAllListeners('image:cacheResolved')
    }
  },

  // 视频
  video: {
    getVideoInfo: (videoMd5: string) => ipcRenderer.invoke('video:getVideoInfo', videoMd5),
    readFile: (videoPath: string) => ipcRenderer.invoke('video:readFile', videoPath),
    parseVideoMd5: (content: string) => ipcRenderer.invoke('video:parseVideoMd5', content)
  },

  // 图片密钥获取
  imageKey: {
    getImageKeys: (userDir: string) => ipcRenderer.invoke('imageKey:getImageKeys', userDir),
    onProgress: (callback: (msg: string) => void) => {
      ipcRenderer.on('imageKey:progress', (_, msg) => callback(msg))
      return () => ipcRenderer.removeAllListeners('imageKey:progress')
    }
  },

  // 聊天
  chat: {
    connect: () => ipcRenderer.invoke('chat:connect'),
    getSessions: () => ipcRenderer.invoke('chat:getSessions'),
    getMessages: (sessionId: string, offset?: number, limit?: number) => 
      ipcRenderer.invoke('chat:getMessages', sessionId, offset, limit),
    getContact: (username: string) => ipcRenderer.invoke('chat:getContact', username),
    getContactAvatar: (username: string) => ipcRenderer.invoke('chat:getContactAvatar', username),
    getMyAvatarUrl: () => ipcRenderer.invoke('chat:getMyAvatarUrl'),
    getMyUserInfo: () => ipcRenderer.invoke('chat:getMyUserInfo'),
    downloadEmoji: (cdnUrl: string, md5?: string) => ipcRenderer.invoke('chat:downloadEmoji', cdnUrl, md5),
    close: () => ipcRenderer.invoke('chat:close'),
    refreshCache: () => ipcRenderer.invoke('chat:refreshCache'),
    getSessionDetail: (sessionId: string) => ipcRenderer.invoke('chat:getSessionDetail', sessionId)
  },

  // 数据分析
  analytics: {
    getOverallStatistics: () => ipcRenderer.invoke('analytics:getOverallStatistics'),
    getContactRankings: (limit?: number) => ipcRenderer.invoke('analytics:getContactRankings', limit),
    getTimeDistribution: () => ipcRenderer.invoke('analytics:getTimeDistribution')
  },

  // 群聊分析
  groupAnalytics: {
    getGroupChats: () => ipcRenderer.invoke('groupAnalytics:getGroupChats'),
    getGroupMembers: (chatroomId: string) => ipcRenderer.invoke('groupAnalytics:getGroupMembers', chatroomId),
    getGroupMessageRanking: (chatroomId: string, limit?: number, startTime?: number, endTime?: number) => ipcRenderer.invoke('groupAnalytics:getGroupMessageRanking', chatroomId, limit, startTime, endTime),
    getGroupActiveHours: (chatroomId: string, startTime?: number, endTime?: number) => ipcRenderer.invoke('groupAnalytics:getGroupActiveHours', chatroomId, startTime, endTime),
    getGroupMediaStats: (chatroomId: string, startTime?: number, endTime?: number) => ipcRenderer.invoke('groupAnalytics:getGroupMediaStats', chatroomId, startTime, endTime)
  },

  // 年度报告
  annualReport: {
    getAvailableYears: () => ipcRenderer.invoke('annualReport:getAvailableYears'),
    generateReport: (year: number) => ipcRenderer.invoke('annualReport:generateReport', year)
  },

  // 导出
  export: {
    exportSessions: (sessionIds: string[], outputDir: string, options: any) => 
      ipcRenderer.invoke('export:exportSessions', sessionIds, outputDir, options),
    exportSession: (sessionId: string, outputPath: string, options: any) => 
      ipcRenderer.invoke('export:exportSession', sessionId, outputPath, options)
  },

  // 激活
  activation: {
    getDeviceId: () => ipcRenderer.invoke('activation:getDeviceId'),
    verifyCode: (code: string) => ipcRenderer.invoke('activation:verifyCode', code),
    activate: (code: string) => ipcRenderer.invoke('activation:activate', code),
    checkStatus: () => ipcRenderer.invoke('activation:checkStatus'),
    getTypeDisplayName: (type: string | null) => ipcRenderer.invoke('activation:getTypeDisplayName', type),
    clearCache: () => ipcRenderer.invoke('activation:clearCache')
  },
  cache: {
    clearImages: () => ipcRenderer.invoke('cache:clearImages'),
    clearAll: () => ipcRenderer.invoke('cache:clearAll'),
    clearConfig: () => ipcRenderer.invoke('cache:clearConfig'),
    getCacheSize: () => ipcRenderer.invoke('cache:getCacheSize')
  },
  log: {
    getLogFiles: () => ipcRenderer.invoke('log:getLogFiles'),
    readLogFile: (filename: string) => ipcRenderer.invoke('log:readLogFile', filename),
    clearLogs: () => ipcRenderer.invoke('log:clearLogs'),
    getLogSize: () => ipcRenderer.invoke('log:getLogSize'),
    getLogDirectory: () => ipcRenderer.invoke('log:getLogDirectory'),
    setLogLevel: (level: string) => ipcRenderer.invoke('log:setLogLevel', level),
    getLogLevel: () => ipcRenderer.invoke('log:getLogLevel')
  }
})

// 主题由 index.html 中的内联脚本处理，这里只负责同步 localStorage
;(async () => {
  try {
    const theme = await ipcRenderer.invoke('config:get', 'theme') || 'cloud-dancer'
    const themeMode = await ipcRenderer.invoke('config:get', 'themeMode') || 'light'
    
    // 更新 localStorage 以供下次同步使用（主窗口场景）
    try {
      localStorage.setItem('theme', theme)
      localStorage.setItem('themeMode', themeMode)
    } catch (e) {
      // localStorage 可能不可用
    }
  } catch (e) {
    // 忽略错误
  }
})()
