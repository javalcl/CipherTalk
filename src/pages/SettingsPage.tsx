import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppStore } from '../stores/appStore'
import { useThemeStore, themes } from '../stores/themeStore'
import { useActivationStore } from '../stores/activationStore'
import { dialog } from '../services/ipc'
import * as configService from '../services/config'
import { 
  Eye, EyeOff, Key, FolderSearch, FolderOpen, Search, 
  RotateCcw, Trash2, Save, Plug, X, Check, Sun, Moon,
  Palette, Database, ImageIcon, Download, HardDrive, Info, RefreshCw, Shield, Clock, CheckCircle, AlertCircle, FileText
} from 'lucide-react'
import './SettingsPage.scss'

type SettingsTab = 'appearance' | 'database' | 'image' | 'export' | 'cache' | 'logs' | 'activation' | 'about'

const tabs: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'appearance', label: '外观', icon: Palette },
  { id: 'database', label: '数据库解密', icon: Database },
  { id: 'image', label: '图片解密', icon: ImageIcon },
  { id: 'export', label: '导出', icon: Download },
  { id: 'cache', label: '缓存', icon: HardDrive },
  { id: 'logs', label: '日志', icon: FileText },
  // { id: 'activation', label: '激活', icon: Shield },
  { id: 'about', label: '关于', icon: Info }
]

function SettingsPage() {
  const [searchParams] = useSearchParams()
  const { setDbConnected, setLoading } = useAppStore()
  const { currentTheme, themeMode, setTheme, setThemeMode } = useThemeStore()
  const { status: activationStatus, checkStatus: checkActivationStatus } = useActivationStore()

  const [activeTab, setActiveTab] = useState<SettingsTab>(() => {
    const tab = searchParams.get('tab')
    if (tab && tabs.some(t => t.id === tab)) {
      return tab as SettingsTab
    }
    return 'appearance'
  })

  // 切换到激活 tab 时自动刷新状态
  useEffect(() => {
    if (activeTab === 'activation') {
      checkActivationStatus()
    }
  }, [activeTab])

  const [decryptKey, setDecryptKey] = useState('')
  const [dbPath, setDbPath] = useState('')
  const [wxid, setWxid] = useState('')
  const [cachePath, setCachePath] = useState('')
  const [imageXorKey, setImageXorKey] = useState('')
  const [imageAesKey, setImageAesKey] = useState('')
  const [exportPath, setExportPath] = useState('')
  const [defaultExportPath, setDefaultExportPath] = useState('')
  
  const [isLoading, setIsLoadingState] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [isGettingKey, setIsGettingKey] = useState(false)
  const [isDetectingPath, setIsDetectingPath] = useState(false)
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [appVersion, setAppVersion] = useState('')
  const [updateInfo, setUpdateInfo] = useState<{ hasUpdate: boolean; version?: string; releaseNotes?: string } | null>(null)
  const [keyStatus, setKeyStatus] = useState('')
  const [message, setMessage] = useState<{ text: string; success: boolean } | null>(null)
  const [showDecryptKey, setShowDecryptKey] = useState(false)
  const [showXorKey, setShowXorKey] = useState(false)
  const [showAesKey, setShowAesKey] = useState(false)
  const [showClearDialog, setShowClearDialog] = useState<{
    type: 'images' | 'all' | 'config'
    title: string
    message: string
  } | null>(null)
  const [cacheSize, setCacheSize] = useState<{
    images: number
    emojis: number
    databases: number
    logs: number
    total: number
  } | null>(null)
  const [isLoadingCacheSize, setIsLoadingCacheSize] = useState(false)

  // 日志相关状态
  const [logFiles, setLogFiles] = useState<Array<{ name: string; size: number; mtime: Date }>>([])
  const [selectedLogFile, setSelectedLogFile] = useState<string>('')
  const [logContent, setLogContent] = useState<string>('')
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)
  const [isLoadingLogContent, setIsLoadingLogContent] = useState(false)
  const [logSize, setLogSize] = useState<number>(0)
  const [currentLogLevel, setCurrentLogLevel] = useState<string>('WARN')

  useEffect(() => {
    loadConfig()
    loadDefaultExportPath()
    loadAppVersion()
    loadCacheSize()
    loadLogFiles()
  }, [])

  const loadConfig = async () => {
    try {
      const savedKey = await configService.getDecryptKey()
      const savedPath = await configService.getDbPath()
      const savedWxid = await configService.getMyWxid()
      const savedCachePath = await configService.getCachePath()
      const savedXorKey = await configService.getImageXorKey()
      const savedAesKey = await configService.getImageAesKey()
      const savedExportPath = await configService.getExportPath()
      
      if (savedKey) setDecryptKey(savedKey)
      if (savedPath) setDbPath(savedPath)
      if (savedWxid) setWxid(savedWxid)
      if (savedCachePath) setCachePath(savedCachePath)
      if (savedXorKey) setImageXorKey(savedXorKey)
      if (savedAesKey) setImageAesKey(savedAesKey)
      if (savedExportPath) setExportPath(savedExportPath)
    } catch (e) {
      console.error('加载配置失败:', e)
    }
  }

  const loadDefaultExportPath = async () => {
    try {
      const downloadsPath = await window.electronAPI.app.getDownloadsPath()
      setDefaultExportPath(downloadsPath)
    } catch (e) {
      console.error('获取默认导出路径失败:', e)
    }
  }

  const loadAppVersion = async () => {
    try {
      const version = await window.electronAPI.app.getVersion()
      setAppVersion(version)
    } catch (e) {
      console.error('获取版本号失败:', e)
    }
  }

  const loadCacheSize = async () => {
    setIsLoadingCacheSize(true)
    try {
      const result = await window.electronAPI.cache.getCacheSize()
      if (result.success && result.size) {
        setCacheSize(result.size)
      }
    } catch (e) {
      console.error('获取缓存大小失败:', e)
    } finally {
      setIsLoadingCacheSize(false)
    }
  }

  const loadLogFiles = async () => {
    setIsLoadingLogs(true)
    try {
      const [filesResult, sizeResult, levelResult] = await Promise.all([
        window.electronAPI.log.getLogFiles(),
        window.electronAPI.log.getLogSize(),
        window.electronAPI.log.getLogLevel()
      ])
      
      if (filesResult.success && filesResult.files) {
        setLogFiles(filesResult.files)
      }
      
      if (sizeResult.success && sizeResult.size !== undefined) {
        setLogSize(sizeResult.size)
      }
      
      if (levelResult.success && levelResult.level) {
        setCurrentLogLevel(levelResult.level)
      }
    } catch (e) {
      console.error('获取日志文件失败:', e)
    } finally {
      setIsLoadingLogs(false)
    }
  }

  const loadLogContent = async (filename: string) => {
    if (!filename) return
    
    setIsLoadingLogContent(true)
    try {
      const result = await window.electronAPI.log.readLogFile(filename)
      if (result.success && result.content) {
        setLogContent(result.content)
      } else {
        setLogContent('无法读取日志文件')
      }
    } catch (e) {
      console.error('读取日志文件失败:', e)
      setLogContent('读取日志文件失败')
    } finally {
      setIsLoadingLogContent(false)
    }
  }

  const handleClearLogs = async () => {
    try {
      const result = await window.electronAPI.log.clearLogs()
      if (result.success) {
        showMessage('日志清除成功', true)
        setLogFiles([])
        setLogContent('')
        setSelectedLogFile('')
        setLogSize(0)
        await loadCacheSize() // 重新加载缓存大小
      } else {
        showMessage(result.error || '日志清除失败', false)
      }
    } catch (e) {
      showMessage(`日志清除失败: ${e}`, false)
    }
  }

  const handleLogFileSelect = (filename: string) => {
    setSelectedLogFile(filename)
    loadLogContent(filename)
  }

  const handleOpenLogDirectory = async () => {
    try {
      const result = await window.electronAPI.log.getLogDirectory()
      if (result.success && result.directory) {
        await window.electronAPI.shell.openPath(result.directory)
      }
    } catch (e) {
      showMessage('打开日志目录失败', false)
    }
  }

  const handleLogLevelChange = async (level: string) => {
    try {
      const result = await window.electronAPI.log.setLogLevel(level)
      if (result.success) {
        setCurrentLogLevel(level)
        showMessage(`日志级别已设置为 ${level}`, true)
      } else {
        showMessage(result.error || '设置日志级别失败', false)
      }
    } catch (e) {
      showMessage('设置日志级别失败', false)
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  // 监听下载进度
  useEffect(() => {
    const removeListener = window.electronAPI.app.onDownloadProgress?.((progress: number) => {
      setDownloadProgress(progress)
    })
    return () => removeListener?.()
  }, [])

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true)
    setUpdateInfo(null)
    try {
      const result = await window.electronAPI.app.checkForUpdates()
      if (result.hasUpdate) {
        setUpdateInfo(result)
        showMessage(`发现新版本 ${result.version}`, true)
      } else {
        showMessage('当前已是最新版本', true)
      }
    } catch (e) {
      showMessage(`检查更新失败: ${e}`, false)
    } finally {
      setIsCheckingUpdate(false)
    }
  }

  const showMessage = (text: string, success: boolean) => {
    setMessage({ text, success })
    setTimeout(() => setMessage(null), 3000)
  }

  const handleClearImages = () => {
    setShowClearDialog({
      type: 'images',
      title: '清除图片',
      message: '此操作将删除所有解密后的图片文件，清除后无法恢复。确定要继续吗？'
    })
  }

  const handleClearAllCache = () => {
    setShowClearDialog({
      type: 'all',
      title: '清除所有',
      message: '此操作将删除所有缓存数据（包括解密后的图片、表情包、数据库文件），清除后无法恢复。确定要继续吗？'
    })
  }

  const handleClearConfig = () => {
    setShowClearDialog({
      type: 'config',
      title: '清除配置',
      message: '此操作将删除所有保存的配置信息（包括密钥、路径等），清除后无法恢复。确定要继续吗？'
    })
  }

  const confirmClear = async () => {
    if (!showClearDialog) return
    
    try {
      let result
      switch (showClearDialog.type) {
        case 'images':
          result = await window.electronAPI.cache.clearImages()
          break
        case 'all':
          result = await window.electronAPI.cache.clearAll()
          break
        case 'config':
          result = await window.electronAPI.cache.clearConfig()
          break
      }
      
      if (result.success) {
        showMessage(`${showClearDialog.title}成功`, true)
        if (showClearDialog.type === 'config') {
          // 清除配置后重新加载
          await loadConfig()
        } else {
          // 清除缓存后重新加载缓存大小
          await loadCacheSize()
        }
      } else {
        showMessage(result.error || `${showClearDialog.title}失败`, false)
      }
    } catch (e) {
      showMessage(`${showClearDialog.title}失败: ${e}`, false)
    } finally {
      setShowClearDialog(null)
    }
  }

  const handleUpdateNow = async () => {
    setIsDownloading(true)
    setDownloadProgress(0)
    try {
      showMessage('正在下载更新...', true)
      await window.electronAPI.app.downloadAndInstall()
    } catch (e) {
      showMessage(`更新失败: ${e}`, false)
      setIsDownloading(false)
    }
  }

  const handleGetKey = async () => {
    if (isGettingKey) return
    setIsGettingKey(true)
    setKeyStatus('正在检查微信进程...')

    try {
      const isRunning = await window.electronAPI.wxKey.isWeChatRunning()
      if (isRunning) {
        const shouldKill = window.confirm('检测到微信正在运行，需要重启微信才能获取密钥。\n是否关闭当前微信？')
        if (!shouldKill) {
          setKeyStatus('已取消')
          setIsGettingKey(false)
          return
        }
        setKeyStatus('正在关闭微信...')
        await window.electronAPI.wxKey.killWeChat()
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      setKeyStatus('正在启动微信...')
      const launched = await window.electronAPI.wxKey.launchWeChat()
      if (!launched) {
        showMessage('微信启动失败，请检查安装路径', false)
        setKeyStatus('')
        setIsGettingKey(false)
        return
      }

      setKeyStatus('等待微信窗口加载...')
      const windowReady = await window.electronAPI.wxKey.waitForWindow(15)
      if (!windowReady) {
        showMessage('等待微信窗口超时', false)
        setKeyStatus('')
        setIsGettingKey(false)
        return
      }

      const removeListener = window.electronAPI.wxKey.onStatus(({ status }) => {
        setKeyStatus(status)
      })

      setKeyStatus('Hook 已安装，请登录微信...')
      const result = await window.electronAPI.wxKey.startGetKey()
      removeListener()

      if (result.success && result.key) {
        setDecryptKey(result.key)
        await configService.setDecryptKey(result.key)
        
        // 自动检测当前登录的微信账号
        setKeyStatus('正在检测当前登录账号...')
        
        // 先尝试较短的时间范围（刚登录的情况）
        let accountInfo = await window.electronAPI.wxKey.detectCurrentAccount(dbPath, 10) // 10分钟
        
        // 如果没找到，尝试更长的时间范围
        if (!accountInfo) {
          accountInfo = await window.electronAPI.wxKey.detectCurrentAccount(dbPath, 60) // 1小时
        }
        
        if (accountInfo) {
          setWxid(accountInfo.wxid)
          await configService.setMyWxid(accountInfo.wxid)
          showMessage(`密钥获取成功！已自动绑定账号: ${accountInfo.wxid}`, true)
        } else {
          showMessage('密钥获取成功，已自动保存！（未能自动检测账号，请手动输入 wxid）', true)
        }
        setKeyStatus('')
      } else {
        showMessage(result.error || '获取密钥失败', false)
        setKeyStatus('')
      }
    } catch (e) {
      showMessage(`获取密钥失败: ${e}`, false)
      setKeyStatus('')
    } finally {
      setIsGettingKey(false)
    }
  }

  const handleCancelGetKey = async () => {
    await window.electronAPI.wxKey.cancel()
    setIsGettingKey(false)
    setKeyStatus('')
  }

  const handleAutoDetectPath = async () => {
    if (isDetectingPath) return
    setIsDetectingPath(true)
    try {
      const result = await window.electronAPI.dbPath.autoDetect()
      if (result.success && result.path) {
        setDbPath(result.path)
        await configService.setDbPath(result.path)
        showMessage(`自动检测成功：${result.path}`, true)
        
        const wxids = await window.electronAPI.dbPath.scanWxids(result.path)
        if (wxids.length === 1) {
          setWxid(wxids[0])
          await configService.setMyWxid(wxids[0])
          showMessage(`已检测到账号：${wxids[0]}`, true)
        } else if (wxids.length > 1) {
          showMessage(`检测到 ${wxids.length} 个账号，请手动选择`, true)
        }
      } else {
        showMessage(result.error || '未能自动检测到数据库目录', false)
      }
    } catch (e) {
      showMessage(`自动检测失败: ${e}`, false)
    } finally {
      setIsDetectingPath(false)
    }
  }

  const handleSelectDbPath = async () => {
    try {
      const result = await dialog.openFile({ title: '选择微信数据库根目录', properties: ['openDirectory'] })
      if (!result.canceled && result.filePaths.length > 0) {
        setDbPath(result.filePaths[0])
        showMessage('已选择数据库目录', true)
      }
    } catch (e) {
      showMessage('选择目录失败', false)
    }
  }

  const handleSelectCachePath = async () => {
    try {
      const result = await dialog.openFile({ title: '选择缓存目录', properties: ['openDirectory'] })
      if (!result.canceled && result.filePaths.length > 0) {
        setCachePath(result.filePaths[0])
        showMessage('已选择缓存目录', true)
      }
    } catch (e) {
      showMessage('选择目录失败', false)
    }
  }

  const handleSelectExportPath = async () => {
    try {
      const result = await dialog.openFile({ title: '选择导出目录', properties: ['openDirectory'] })
      if (!result.canceled && result.filePaths.length > 0) {
        setExportPath(result.filePaths[0])
        await configService.setExportPath(result.filePaths[0])
        showMessage('已设置导出目录', true)
      }
    } catch (e) {
      showMessage('选择目录失败', false)
    }
  }

  const handleResetExportPath = async () => {
    try {
      const downloadsPath = await window.electronAPI.app.getDownloadsPath()
      setExportPath(downloadsPath)
      await configService.setExportPath(downloadsPath)
      showMessage('已恢复为下载目录', true)
    } catch (e) {
      showMessage('恢复默认失败', false)
    }
  }

  const handleTestConnection = async () => {
    if (!dbPath) { showMessage('请先选择数据库目录', false); return }
    if (!decryptKey) { showMessage('请先输入解密密钥', false); return }
    if (decryptKey.length !== 64) { showMessage('密钥长度必须为64个字符', false); return }
    if (!wxid) { showMessage('请先输入或扫描 wxid', false); return }

    setIsTesting(true)
    try {
      const result = await window.electronAPI.wcdb.testConnection(dbPath, decryptKey, wxid)
      if (result.success) {
        showMessage('连接测试成功！数据库可正常访问', true)
      } else {
        showMessage(result.error || '连接测试失败', false)
      }
    } catch (e) {
      showMessage(`连接测试失败: ${e}`, false)
    } finally {
      setIsTesting(false)
    }
  }

  const handleSaveConfig = async () => {
    setIsLoadingState(true)
    setLoading(true, '正在保存配置...')

    try {
      // 保存数据库相关配置
      if (decryptKey) await configService.setDecryptKey(decryptKey)
      if (dbPath) await configService.setDbPath(dbPath)
      if (wxid) await configService.setMyWxid(wxid)
      await configService.setCachePath(cachePath)
      
      // 保存图片密钥（包括空值）
      await configService.setImageXorKey(imageXorKey)
      await configService.setImageAesKey(imageAesKey)
      
      // 保存导出路径
      if (exportPath) await configService.setExportPath(exportPath)

      // 如果数据库配置完整，测试连接
      if (decryptKey && dbPath && wxid && decryptKey.length === 64) {
        showMessage('配置保存成功，正在测试连接...', true)
        const result = await window.electronAPI.wcdb.testConnection(dbPath, decryptKey, wxid, true) // 标记为自动连接

        if (result.success) {
          setDbConnected(true, dbPath)
          showMessage('配置保存成功！数据库连接正常', true)
        } else {
          showMessage('配置已保存，但数据库连接失败：' + (result.error || ''), false)
        }
      } else {
        showMessage('配置保存成功', true)
      }
    } catch (e) {
      showMessage(`保存配置失败: ${e}`, false)
    } finally {
      setIsLoadingState(false)
      setLoading(false)
    }
  }

  const renderAppearanceTab = () => (
    <div className="tab-content">
      <div className="theme-mode-toggle">
        <button className={`mode-btn ${themeMode === 'light' ? 'active' : ''}`} onClick={() => setThemeMode('light')}>
          <Sun size={16} /> 浅色
        </button>
        <button className={`mode-btn ${themeMode === 'dark' ? 'active' : ''}`} onClick={() => setThemeMode('dark')}>
          <Moon size={16} /> 深色
        </button>
      </div>
      <div className="theme-grid">
        {themes.map((theme) => (
          <div key={theme.id} className={`theme-card ${currentTheme === theme.id ? 'active' : ''}`} onClick={() => setTheme(theme.id)}>
            <div className="theme-preview" style={{ background: themeMode === 'dark' ? 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)' : `linear-gradient(135deg, ${theme.bgColor} 0%, ${theme.bgColor}dd 100%)` }}>
              <div className="theme-accent" style={{ background: theme.primaryColor }} />
            </div>
            <div className="theme-info">
              <span className="theme-name">{theme.name}</span>
              <span className="theme-desc">{theme.description}</span>
            </div>
            {currentTheme === theme.id && <div className="theme-check"><Check size={14} /></div>}
          </div>
        ))}
      </div>
    </div>
  )

  const renderDatabaseTab = () => (
    <div className="tab-content">
      <div className="form-group">
        <label>解密密钥</label>
        <span className="form-hint">64位十六进制密钥</span>
        <div className="input-with-toggle">
          <input type={showDecryptKey ? 'text' : 'password'} placeholder="例如: a1b2c3d4e5f6..." value={decryptKey} onChange={(e) => setDecryptKey(e.target.value)} />
          <button type="button" className="toggle-visibility" onClick={() => setShowDecryptKey(!showDecryptKey)}>
            {showDecryptKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        {keyStatus && <span className="key-status">{keyStatus}</span>}
        <div className="btn-row">
          <button className="btn btn-primary" onClick={handleGetKey} disabled={isGettingKey}>
            <Key size={16} /> {isGettingKey ? '获取中...' : '自动获取密钥'}
          </button>
          {isGettingKey && <button className="btn btn-secondary" onClick={handleCancelGetKey}><X size={16} /> 取消</button>}
        </div>
      </div>

      <div className="form-group">
        <label>数据库根目录</label>
        <span className="form-hint">xwechat_files 目录</span>
        <input type="text" placeholder="例如: C:\Users\xxx\Documents\xwechat_files" value={dbPath} onChange={(e) => setDbPath(e.target.value)} />
        <div className="btn-row">
          <button className="btn btn-primary" onClick={handleAutoDetectPath} disabled={isDetectingPath}>
            <FolderSearch size={16} /> {isDetectingPath ? '检测中...' : '自动检测'}
          </button>
          <button className="btn btn-secondary" onClick={handleSelectDbPath}><FolderOpen size={16} /> 浏览选择</button>
        </div>
      </div>

      <div className="form-group">
        <label>账号 wxid</label>
        <span className="form-hint">微信账号标识</span>
        <input type="text" placeholder="例如: wxid_xxxxxx" value={wxid} onChange={(e) => setWxid(e.target.value)} />
        <button className="btn btn-secondary btn-sm"><Search size={14} /> 扫描 wxid</button>
      </div>

      <div className="form-group">
        <label>缓存目录 <span className="optional">(可选)</span></label>
        <span className="form-hint">留空使用默认目录，尽可能不选择C盘</span>
        <input type="text" placeholder="留空使用默认目录" value={cachePath} onChange={(e) => setCachePath(e.target.value)} />
        <div className="btn-row">
          <button className="btn btn-secondary" onClick={handleSelectCachePath}><FolderOpen size={16} /> 浏览选择</button>
          <button className="btn btn-secondary" onClick={() => setCachePath('')}><RotateCcw size={16} /> 恢复默认</button>
        </div>
      </div>
    </div>
  )

  const [isGettingImageKey, setIsGettingImageKey] = useState(false)
  const [imageKeyStatus, setImageKeyStatus] = useState('')

  const handleGetImageKey = async () => {
    if (isGettingImageKey) return
    if (!dbPath) {
      showMessage('请先配置数据库路径', false)
      return
    }
    if (!wxid) {
      showMessage('请先配置 wxid', false)
      return
    }

    setIsGettingImageKey(true)
    setImageKeyStatus('正在检查微信进程...')

    try {
      const isRunning = await window.electronAPI.wxKey.isWeChatRunning()
      if (!isRunning) {
        showMessage('请先启动微信并登录', false)
        setImageKeyStatus('')
        setIsGettingImageKey(false)
        return
      }

      // 构建用户目录路径
      const userDir = `${dbPath}\\${wxid}`

      const removeListener = window.electronAPI.imageKey.onProgress((msg) => {
        setImageKeyStatus(msg)
      })

      const result = await window.electronAPI.imageKey.getImageKeys(userDir)
      removeListener()

      if (result.success) {
        if (result.xorKey !== undefined) {
          const xorKeyHex = `0x${result.xorKey.toString(16).padStart(2, '0')}`
          setImageXorKey(xorKeyHex)
          await configService.setImageXorKey(xorKeyHex)
        }
        if (result.aesKey) {
          setImageAesKey(result.aesKey)
          await configService.setImageAesKey(result.aesKey)
        }
        showMessage('图片密钥获取成功！', true)
        setImageKeyStatus('')
      } else {
        showMessage(result.error || '获取图片密钥失败', false)
        setImageKeyStatus('')
      }
    } catch (e) {
      showMessage(`获取图片密钥失败: ${e}`, false)
      setImageKeyStatus('')
    } finally {
      setIsGettingImageKey(false)
    }
  }

  const renderImageTab = () => (
    <div className="tab-content">
      <p className="section-desc">您只负责获取密钥，其他的交给密语-CipherTalk</p>
      
      <div className="form-group">
        <label>XOR 密钥</label>
        <span className="form-hint">2位十六进制，如 0x53</span>
        <div className="input-with-toggle">
          <input type={showXorKey ? 'text' : 'password'} placeholder="例如: 0x12" value={imageXorKey} onChange={(e) => setImageXorKey(e.target.value)} />
          <button type="button" className="toggle-visibility" onClick={() => setShowXorKey(!showXorKey)}>
            {showXorKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      <div className="form-group">
        <label>AES 密钥</label>
        <span className="form-hint">至少16个字符（V4版本图片需要）</span>
        <div className="input-with-toggle">
          <input type={showAesKey ? 'text' : 'password'} placeholder="例如: b123456789012345..." value={imageAesKey} onChange={(e) => setImageAesKey(e.target.value)} />
          <button type="button" className="toggle-visibility" onClick={() => setShowAesKey(!showAesKey)}>
            {showAesKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>

      {imageKeyStatus && <p className="key-status">{imageKeyStatus}</p>}

      <button className="btn btn-primary" onClick={handleGetImageKey} disabled={isGettingImageKey}>
        <ImageIcon size={16} /> {isGettingImageKey ? '获取中...' : '自动获取图片密钥'}
      </button>
    </div>
  )

  const renderExportTab = () => (
    <div className="tab-content">
      <div className="form-group">
        <label>导出目录</label>
        <span className="form-hint">聊天记录导出的默认保存位置</span>
        <input type="text" placeholder={defaultExportPath || '系统下载目录'} value={exportPath || defaultExportPath} onChange={(e) => setExportPath(e.target.value)} />
        <div className="btn-row">
          <button className="btn btn-secondary" onClick={handleSelectExportPath}><FolderOpen size={16} /> 浏览选择</button>
          <button className="btn btn-secondary" onClick={handleResetExportPath}><RotateCcw size={16} /> 恢复默认</button>
        </div>
      </div>
    </div>
  )

  const renderCacheTab = () => (
    <div className="tab-content">
      <p className="section-desc">管理应用缓存数据</p>
      
      {/* 缓存大小显示 */}
      <div className="cache-size-info">
        <div className="cache-header">
          <h3>缓存占用</h3>
          <button className="btn btn-secondary btn-sm" onClick={loadCacheSize} disabled={isLoadingCacheSize}>
            <RefreshCw size={14} className={isLoadingCacheSize ? 'spin' : ''} />
            刷新
          </button>
        </div>
        {isLoadingCacheSize ? (
          <p>正在计算...</p>
        ) : cacheSize ? (
          <div className="cache-items">
            <div className="cache-item">
              <span className="cache-label">图片缓存:</span>
              <span className="cache-value">{formatFileSize(cacheSize.images)}</span>
            </div>
            <div className="cache-item">
              <span className="cache-label">表情包缓存:</span>
              <span className="cache-value">{formatFileSize(cacheSize.emojis)}</span>
            </div>
            <div className="cache-item">
              <span className="cache-label">数据库文件:</span>
              <span className="cache-value">{formatFileSize(cacheSize.databases)}</span>
            </div>
            <div className="cache-item">
              <span className="cache-label">日志文件:</span>
              <span className="cache-value">{formatFileSize(cacheSize.logs)}</span>
            </div>
            <div className="cache-item total">
              <span className="cache-label">总计:</span>
              <span className="cache-value">{formatFileSize(cacheSize.total)}</span>
            </div>
          </div>
        ) : (
          <p>无法获取缓存信息</p>
        )}
      </div>

      <div className="btn-row">
        <button className="btn btn-secondary" onClick={handleClearImages}>
          <Trash2 size={16} /> 清除图片
        </button>
        <button className="btn btn-secondary" onClick={handleClearConfig}>
          <Trash2 size={16} /> 清除配置
        </button>
        <button className="btn btn-danger" onClick={handleClearAllCache}>
          <Trash2 size={16} /> 清除缓存
        </button>
      </div>
    </div>
  )

  const renderLogsTab = () => (
    <div className="tab-content">
      <p className="section-desc">查看和管理应用日志</p>
      
      {/* 日志级别设置 */}
      <div className="log-level-setting">
        <div className="form-group">
          <label>日志级别</label>
          <span className="form-hint">选择要记录的最低日志级别</span>
          <div className="log-level-options">
            {['DEBUG', 'INFO', 'WARN', 'ERROR'].map((level) => (
              <button
                key={level}
                className={`log-level-btn ${currentLogLevel === level ? 'active' : ''}`}
                onClick={() => handleLogLevelChange(level)}
              >
                {level}
              </button>
            ))}
          </div>
          <div className="log-level-desc">
            <small>
              {currentLogLevel === 'DEBUG' && '记录所有日志（调试、信息、警告、错误）'}
              {currentLogLevel === 'INFO' && '记录信息、警告和错误日志'}
              {currentLogLevel === 'WARN' && '仅记录警告和错误日志（推荐）'}
              {currentLogLevel === 'ERROR' && '仅记录错误日志'}
            </small>
          </div>
        </div>
      </div>
      
      {/* 日志统计 */}
      <div className="log-stats">
        <div className="log-header">
          <h3>日志统计</h3>
          <button className="btn btn-secondary btn-sm" onClick={loadLogFiles} disabled={isLoadingLogs}>
            <RefreshCw size={14} className={isLoadingLogs ? 'spin' : ''} />
            刷新
          </button>
        </div>
        <div className="log-info">
          <div className="log-item">
            <span className="log-label">日志文件数:</span>
            <span className="log-value">{logFiles.length} 个</span>
          </div>
          <div className="log-item">
            <span className="log-label">总大小:</span>
            <span className="log-value">{formatFileSize(logSize)}</span>
          </div>
          <div className="log-item">
            <span className="log-label">当前级别:</span>
            <span className="log-value">{currentLogLevel}</span>
          </div>
        </div>
      </div>

      {/* 日志文件列表 */}
      <div className="log-files">
        <h4>日志文件</h4>
        {isLoadingLogs ? (
          <p>正在加载...</p>
        ) : logFiles.length > 0 ? (
          <div className="log-file-list">
            {logFiles.map((file) => (
              <div 
                key={file.name} 
                className={`log-file-item ${selectedLogFile === file.name ? 'selected' : ''}`}
                onClick={() => handleLogFileSelect(file.name)}
              >
                <div className="log-file-info">
                  <span className="log-file-name">{file.name}</span>
                  <span className="log-file-size">{formatFileSize(file.size)}</span>
                </div>
                <div className="log-file-date">
                  {new Date(file.mtime).toLocaleString('zh-CN')}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>暂无日志文件</p>
        )}
      </div>

      {/* 日志内容 */}
      {selectedLogFile && (
        <div className="log-content">
          <div className="log-content-header">
            <h4>日志内容 - {selectedLogFile}</h4>
          </div>
          {isLoadingLogContent ? (
            <p>正在加载...</p>
          ) : (
            <div className="log-content-text">
              <pre>{logContent}</pre>
            </div>
          )}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="btn-row">
        <button className="btn btn-secondary" onClick={handleOpenLogDirectory}>
          <FolderOpen size={16} /> 打开日志目录
        </button>
        <button className="btn btn-danger" onClick={handleClearLogs}>
          <Trash2 size={16} /> 清除所有日志
        </button>
      </div>
    </div>
  )

  const getTypeDisplayName = (type: string | null) => {
    if (!type) return '未激活'
    const typeMap: Record<string, string> = {
      '30days': '30天试用版',
      '90days': '90天标准版',
      '365days': '365天专业版',
      'permanent': '永久版'
    }
    return typeMap[type] || type
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '永久'
    return new Date(dateStr).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const renderActivationTab = () => (
    <div className="tab-content activation-tab">
      <div className={`activation-status-card ${activationStatus?.isActivated ? 'activated' : 'inactive'}`}>
        <div className="status-icon">
          {activationStatus?.isActivated ? (
            <CheckCircle size={48} />
          ) : (
            <AlertCircle size={48} />
          )}
        </div>
        <div className="status-content">
          <h3>{activationStatus?.isActivated ? '已激活' : '未激活'}</h3>
          {activationStatus?.isActivated && (
            <>
              <p className="status-type">{getTypeDisplayName(activationStatus.type)}</p>
              {activationStatus.daysRemaining !== null && activationStatus.type !== 'permanent' && (
                <p className="status-expires">
                  <Clock size={14} />
                  {activationStatus.daysRemaining > 0 
                    ? `剩余 ${activationStatus.daysRemaining} 天` 
                    : '已过期'}
                </p>
              )}
              {activationStatus.expiresAt && (
                <p className="status-date">到期时间：{formatDate(activationStatus.expiresAt)}</p>
              )}
              {activationStatus.activatedAt && (
                <p className="status-date">激活时间：{formatDate(activationStatus.activatedAt)}</p>
              )}
            </>
          )}
        </div>
      </div>

      <div className="device-info-card">
        <h4>设备信息</h4>
        <div className="device-id-row">
          <span className="label">设备标识：</span>
          <code>{activationStatus?.deviceId || '获取中...'}</code>
        </div>
      </div>

      <div className="activation-actions">
        <button className="btn btn-secondary" onClick={() => checkActivationStatus()}>
          <RefreshCw size={16} /> 刷新状态
        </button>
        <button className="btn btn-primary" onClick={() => window.electronAPI.window.openPurchaseWindow()}>
          <Key size={16} /> 获取激活码
        </button>
      </div>
    </div>
  )

  const renderAboutTab = () => (
    <div className="tab-content about-tab">
      <div className="about-card">
        <div className="about-logo">
          <img src="./logo.png" alt="密语" />
        </div>
        <h2 className="about-name">密语</h2>
        <p className="about-slogan">CipherTalk</p>
        <p className="about-version">v{appVersion || '...'}</p>
        
        <div className="about-update">
          {updateInfo?.hasUpdate ? (
            <>
              <p className="update-hint">新版本 v{updateInfo.version} 可用</p>
              {isDownloading ? (
                <div className="download-progress">
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${downloadProgress}%` }} />
                  </div>
                  <span>{downloadProgress.toFixed(0)}%</span>
                </div>
              ) : (
                <button className="btn btn-primary" onClick={handleUpdateNow}>
                  <Download size={16} /> 立即更新
                </button>
              )}
            </>
          ) : (
            <button className="btn btn-secondary" onClick={handleCheckUpdate} disabled={isCheckingUpdate}>
              <RefreshCw size={16} className={isCheckingUpdate ? 'spin' : ''} />
              {isCheckingUpdate ? '检查中...' : '检查更新'}
            </button>
          )}
        </div>
      </div>

      <div className="about-footer">
        <p className="about-desc">
          微信聊天记录分析工具，基于 <a href="#" onClick={(e) => { e.preventDefault(); window.electronAPI.shell.openExternal('https://github.com/ycccccccy/echotrace') }}>EchoTrace</a> 重构开发，已获得原作者 <a href="#" onClick={(e) => { e.preventDefault(); window.electronAPI.shell.openExternal('https://github.com/ycccccccy') }}>ycccccccy</a> 授权。
        </p>
        <p className="about-warning">原项目完全免费，凡是通过非 GitHub 下载echotrace且收费的均为骗子，请勿上当！</p>
        <div className="about-links">
          <a href="#" onClick={(e) => { e.preventDefault(); window.electronAPI.shell.openExternal('https://miyu.aiqji.com') }}>官网</a>
          <span>·</span>
          <a href="#" onClick={(e) => { e.preventDefault(); window.electronAPI.shell.openExternal('https://chatlab.fun') }}>ChatLab</a>
          <span>·</span>
          <a href="#" onClick={(e) => { e.preventDefault(); window.electronAPI.window.openAgreementWindow() }}>用户协议</a>
        </div>
        <p className="copyright">© 2025 密语-CipherTalk. All rights reserved.</p>
      </div>
    </div>
  )

  return (
    <div className="settings-page">
      {message && <div className={`message-toast ${message.success ? 'success' : 'error'}`}>{message.text}</div>}

      {/* 清除确认对话框 */}
      {showClearDialog && (
        <div className="clear-dialog-overlay">
          <div className="clear-dialog">
            <h3>{showClearDialog.title}</h3>
            <p>{showClearDialog.message}</p>
            <div className="dialog-actions">
              <button 
                className="btn btn-danger" 
                onClick={confirmClear}
              >
                确定
              </button>
              <button 
                className="btn btn-secondary dialog-cancel" 
                onClick={() => setShowClearDialog(null)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="settings-header">
        <h1>设置</h1>
        <div className="settings-actions">
          <button className="btn btn-secondary" onClick={handleTestConnection} disabled={isLoading || isTesting}>
            <Plug size={16} /> {isTesting ? '测试中...' : '测试连接'}
          </button>
          <button className="btn btn-primary" onClick={handleSaveConfig} disabled={isLoading}>
            <Save size={16} /> {isLoading ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>

      <div className="settings-tabs">
        {tabs.map(tab => (
          <button key={tab.id} className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
            <tab.icon size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="settings-body">
        {activeTab === 'appearance' && renderAppearanceTab()}
        {activeTab === 'database' && renderDatabaseTab()}
        {activeTab === 'image' && renderImageTab()}
        {activeTab === 'export' && renderExportTab()}
        {activeTab === 'cache' && renderCacheTab()}
        {activeTab === 'logs' && renderLogsTab()}
        {activeTab === 'activation' && renderActivationTab()}
        {activeTab === 'about' && renderAboutTab()}
      </div>
    </div>
  )
}

export default SettingsPage
