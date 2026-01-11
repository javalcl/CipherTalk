import type { ChatSession, Message, Contact } from './models'

export interface ElectronAPI {
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
    openChatWindow: () => Promise<boolean>
    openGroupAnalyticsWindow: () => Promise<boolean>
    openAnnualReportWindow: (year: number) => Promise<boolean>
    openAgreementWindow: () => Promise<boolean>
    openPurchaseWindow: () => Promise<boolean>
    isChatWindowOpen: () => Promise<boolean>
    closeChatWindow: () => Promise<boolean>
    setTitleBarOverlay: (options: { symbolColor: string }) => void
  }
  config: {
    get: (key: string) => Promise<unknown>
    set: (key: string, value: unknown) => Promise<void>
    getTldCache: () => Promise<{ tlds: string[]; updatedAt: number } | null>
    setTldCache: (tlds: string[]) => Promise<void>
  }
  db: {
    open: (dbPath: string, key?: string) => Promise<boolean>
    query: <T = unknown>(sql: string, params?: unknown[]) => Promise<T[]>
    close: () => Promise<void>
  }
  decrypt: {
    database: (sourcePath: string, key: string, outputPath: string) => Promise<boolean>
    image: (imagePath: string) => Promise<Uint8Array | null>
  }
  dialog: {
    openFile: (options?: Electron.OpenDialogOptions) => Promise<Electron.OpenDialogReturnValue>
    saveFile: (options?: Electron.SaveDialogOptions) => Promise<Electron.SaveDialogReturnValue>
  }
  shell: {
    openPath: (path: string) => Promise<string>
    openExternal: (url: string) => Promise<void>
  }
  app: {
    getDownloadsPath: () => Promise<string>
    getVersion: () => Promise<string>
    checkForUpdates: () => Promise<{ hasUpdate: boolean; version?: string; releaseNotes?: string }>
    downloadAndInstall: () => Promise<void>
    onDownloadProgress: (callback: (progress: number) => void) => () => void
    onUpdateAvailable: (callback: (info: { version: string; releaseNotes: string }) => void) => () => void
  }
  wxKey: {
    isWeChatRunning: () => Promise<boolean>
    getWeChatPid: () => Promise<number | null>
    killWeChat: () => Promise<boolean>
    launchWeChat: () => Promise<boolean>
    waitForWindow: (maxWaitSeconds?: number) => Promise<boolean>
    startGetKey: () => Promise<{ success: boolean; key?: string; error?: string }>
    cancel: () => Promise<boolean>
    detectCurrentAccount: (dbPath?: string, maxTimeDiffMinutes?: number) => Promise<{ wxid: string; dbPath: string } | null>
    onStatus: (callback: (data: { status: string; level: number }) => void) => () => void
  }
  dbPath: {
    autoDetect: () => Promise<{ success: boolean; path?: string; error?: string }>
    scanWxids: (rootPath: string) => Promise<string[]>
    getDefault: () => Promise<string>
  }
  wcdb: {
    testConnection: (dbPath: string, hexKey: string, wxid: string, isAutoConnect?: boolean) => Promise<{ success: boolean; error?: string; sessionCount?: number }>
    open: (dbPath: string, hexKey: string, wxid: string) => Promise<boolean>
    close: () => Promise<boolean>
  }
  dataManagement: {
    scanDatabases: () => Promise<{
      success: boolean
      databases?: DatabaseFileInfo[]
      error?: string
    }>
    decryptAll: () => Promise<{
      success: boolean
      successCount?: number
      failCount?: number
      error?: string
    }>
    incrementalUpdate: () => Promise<{
      success: boolean
      successCount?: number
      failCount?: number
      error?: string
    }>
    getCurrentCachePath: () => Promise<string>
    getDefaultCachePath: () => Promise<string>
    migrateCache: (newCachePath: string) => Promise<{
      success: boolean
      movedCount?: number
      error?: string
    }>
    scanImages: (dirPath: string) => Promise<{
      success: boolean
      images?: ImageFileInfo[]
      error?: string
    }>
    decryptImages: (dirPath: string) => Promise<{
      success: boolean
      successCount?: number
      failCount?: number
      error?: string
    }>
    getImageDirectories: () => Promise<{
      success: boolean
      directories?: { wxid: string; path: string }[]
      error?: string
    }>
    decryptSingleImage: (filePath: string) => Promise<{
      success: boolean
      outputPath?: string
      error?: string
    }>
    onProgress: (callback: (data: DecryptProgress) => void) => () => void
  }
  imageDecrypt: {
    batchDetectXorKey: (dirPath: string) => Promise<{ success: boolean; key?: number | null; error?: string }>
    decryptImage: (inputPath: string, outputPath: string, xorKey: number, aesKey?: string) => Promise<{ success: boolean; error?: string }>
  }
  image: {
    decrypt: (payload: { sessionId?: string; imageMd5?: string; imageDatName?: string; force?: boolean }) => Promise<{ success: boolean; localPath?: string; error?: string }>
    resolveCache: (payload: { sessionId?: string; imageMd5?: string; imageDatName?: string }) => Promise<{ success: boolean; localPath?: string; hasUpdate?: boolean; error?: string }>
    onUpdateAvailable: (callback: (data: { cacheKey: string; imageMd5?: string; imageDatName?: string }) => void) => () => void
    onCacheResolved: (callback: (data: { cacheKey: string; imageMd5?: string; imageDatName?: string; localPath: string }) => void) => () => void
  }
  video: {
    getVideoInfo: (videoMd5: string) => Promise<{
      success: boolean
      error?: string
      exists: boolean
      videoUrl?: string
      coverUrl?: string
      thumbUrl?: string
    }>
    readFile: (videoPath: string) => Promise<{
      success: boolean
      error?: string
      data?: string
    }>
    parseVideoMd5: (content: string) => Promise<{
      success: boolean
      error?: string
      md5?: string
    }>
  }
  imageKey: {
    getImageKeys: (userDir: string) => Promise<{ success: boolean; xorKey?: number; aesKey?: string; error?: string }>
    onProgress: (callback: (msg: string) => void) => () => void
  }
  chat: {
    connect: () => Promise<{ success: boolean; error?: string }>
    getSessions: () => Promise<{ success: boolean; sessions?: ChatSession[]; error?: string }>
    getMessages: (sessionId: string, offset?: number, limit?: number) => Promise<{ 
      success: boolean; 
      messages?: Message[]; 
      hasMore?: boolean; 
      error?: string 
    }>
    getContact: (username: string) => Promise<Contact | null>
    getContactAvatar: (username: string) => Promise<{ avatarUrl?: string; displayName?: string } | null>
    getMyAvatarUrl: () => Promise<{ success: boolean; avatarUrl?: string; error?: string }>
    getMyUserInfo: () => Promise<{ 
      success: boolean
      userInfo?: {
        wxid: string
        nickName: string
        alias: string
        avatarUrl: string
      }
      error?: string 
    }>
    downloadEmoji: (cdnUrl: string, md5?: string) => Promise<{ success: boolean; localPath?: string; error?: string }>
    close: () => Promise<boolean>
    refreshCache: () => Promise<boolean>
    getSessionDetail: (sessionId: string) => Promise<{
      success: boolean
      detail?: {
        wxid: string
        displayName: string
        remark?: string
        nickName?: string
        alias?: string
        avatarUrl?: string
        messageCount: number
        firstMessageTime?: number
        latestMessageTime?: number
        messageTables: { dbName: string; tableName: string; count: number }[]
      }
      error?: string
    }>
  }
  analytics: {
    getOverallStatistics: () => Promise<{ 
      success: boolean
      data?: {
        totalMessages: number
        textMessages: number
        imageMessages: number
        voiceMessages: number
        videoMessages: number
        emojiMessages: number
        otherMessages: number
        sentMessages: number
        receivedMessages: number
        firstMessageTime: number | null
        lastMessageTime: number | null
        activeDays: number
        messageTypeCounts: Record<number, number>
      }
      error?: string 
    }>
    getContactRankings: (limit?: number) => Promise<{
      success: boolean
      data?: Array<{
        username: string
        displayName: string
        avatarUrl?: string
        messageCount: number
        sentCount: number
        receivedCount: number
        lastMessageTime: number | null
      }>
      error?: string
    }>
    getTimeDistribution: () => Promise<{
      success: boolean
      data?: {
        hourlyDistribution: Record<number, number>
        weekdayDistribution: Record<number, number>
        monthlyDistribution: Record<string, number>
      }
      error?: string
    }>
  }
  groupAnalytics: {
    getGroupChats: () => Promise<{
      success: boolean
      data?: Array<{
        username: string
        displayName: string
        memberCount: number
        avatarUrl?: string
      }>
      error?: string
    }>
    getGroupMembers: (chatroomId: string) => Promise<{
      success: boolean
      data?: Array<{
        username: string
        displayName: string
        avatarUrl?: string
      }>
      error?: string
    }>
    getGroupMessageRanking: (chatroomId: string, limit?: number, startTime?: number, endTime?: number) => Promise<{
      success: boolean
      data?: Array<{
        member: {
          username: string
          displayName: string
          avatarUrl?: string
        }
        messageCount: number
      }>
      error?: string
    }>
    getGroupActiveHours: (chatroomId: string, startTime?: number, endTime?: number) => Promise<{
      success: boolean
      data?: {
        hourlyDistribution: Record<number, number>
      }
      error?: string
    }>
    getGroupMediaStats: (chatroomId: string, startTime?: number, endTime?: number) => Promise<{
      success: boolean
      data?: {
        typeCounts: Array<{
          type: number
          name: string
          count: number
        }>
        total: number
      }
      error?: string
    }>
  }
  annualReport: {
    getAvailableYears: () => Promise<{
      success: boolean
      data?: number[]
      error?: string
    }>
    generateReport: (year: number) => Promise<{
      success: boolean
      data?: {
        year: number
        totalMessages: number
        totalFriends: number
        coreFriends: Array<{
          username: string
          displayName: string
          avatarUrl?: string
          messageCount: number
          sentCount: number
          receivedCount: number
        }>
        monthlyTopFriends: Array<{
          month: number
          displayName: string
          avatarUrl?: string
          messageCount: number
        }>
        peakDay: {
          date: string
          messageCount: number
          topFriend?: string
          topFriendCount?: number
        } | null
        longestStreak: {
          friendName: string
          days: number
          startDate: string
          endDate: string
        } | null
        activityHeatmap: {
          data: number[][]
        }
        midnightKing: {
          displayName: string
          count: number
          percentage: number
        } | null
        selfAvatarUrl?: string
      }
      error?: string
    }>
  }
  export: {
    exportSessions: (sessionIds: string[], outputDir: string, options: ExportOptions) => Promise<{
      success: boolean
      successCount?: number
      failCount?: number
      error?: string
    }>
    exportSession: (sessionId: string, outputPath: string, options: ExportOptions) => Promise<{
      success: boolean
      error?: string
    }>
  }
  activation: {
    getDeviceId: () => Promise<string>
    verifyCode: (code: string) => Promise<{ success: boolean; message: string }>
    activate: (code: string) => Promise<ActivationResult>
    checkStatus: () => Promise<ActivationStatus>
    getTypeDisplayName: (type: string | null) => Promise<string>
    clearCache: () => Promise<boolean>
  }
  cache: {
    clearImages: () => Promise<{ success: boolean; error?: string }>
    clearAll: () => Promise<{ success: boolean; error?: string }>
    clearConfig: () => Promise<{ success: boolean; error?: string }>
    getCacheSize: () => Promise<{ 
      success: boolean; 
      error?: string;
      size?: {
        images: number
        emojis: number
        databases: number
        logs: number
        total: number
      }
    }>
  }
  log: {
    getLogFiles: () => Promise<{ 
      success: boolean; 
      error?: string;
      files?: Array<{ name: string; size: number; mtime: Date }>
    }>
    readLogFile: (filename: string) => Promise<{ 
      success: boolean; 
      error?: string;
      content?: string
    }>
    clearLogs: () => Promise<{ success: boolean; error?: string }>
    getLogSize: () => Promise<{ 
      success: boolean; 
      error?: string;
      size?: number
    }>
    getLogDirectory: () => Promise<{ 
      success: boolean; 
      error?: string;
      directory?: string
    }>
    setLogLevel: (level: string) => Promise<{ success: boolean; error?: string }>
    getLogLevel: () => Promise<{ 
      success: boolean; 
      error?: string;
      level?: string
    }>
  }
}

export interface ExportOptions {
  format: 'chatlab' | 'chatlab-jsonl' | 'json' | 'html' | 'txt' | 'excel' | 'sql'
  dateRange?: { start: number; end: number } | null
  exportMedia?: boolean
  exportAvatars?: boolean
}

export interface DatabaseFileInfo {
  fileName: string
  filePath: string
  fileSize: number
  wxid: string
  isDecrypted: boolean
  decryptedPath?: string
  needsUpdate?: boolean
}

export interface ImageFileInfo {
  fileName: string
  filePath: string
  fileSize: number
  isDecrypted: boolean
  decryptedPath?: string
  version: number  // 0=V3, 1=V4-V1, 2=V4-V2
}

export interface DecryptProgress {
  type: 'decrypt' | 'update' | 'migrate' | 'image' | 'imageBatch' | 'imageScanComplete' | 'complete' | 'error'
  current?: number
  total?: number
  fileName?: string
  fileProgress?: number
  error?: string
  images?: ImageFileInfo[]
}

export interface ActivationStatus {
  isActivated: boolean
  type: string | null
  expiresAt: string | null
  activatedAt: string | null
  daysRemaining: number | null
  deviceId: string
}

export interface ActivationResult {
  success: boolean
  message: string
  data?: {
    type: string
    expires_at: string | null
    activated_at: string
  }
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
  
  // Electron 类型声明
  namespace Electron {
    interface OpenDialogOptions {
      title?: string
      defaultPath?: string
      filters?: { name: string; extensions: string[] }[]
      properties?: ('openFile' | 'openDirectory' | 'multiSelections')[]
    }
    interface OpenDialogReturnValue {
      canceled: boolean
      filePaths: string[]
    }
    interface SaveDialogOptions {
      title?: string
      defaultPath?: string
      filters?: { name: string; extensions: string[] }[]
    }
    interface SaveDialogReturnValue {
      canceled: boolean
      filePath?: string
    }
  }
}

export {}
