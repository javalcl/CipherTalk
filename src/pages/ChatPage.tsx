import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Search, MessageSquare, AlertCircle, Loader2, RefreshCw, X, ChevronDown, Info, Calendar, Database, Hash, Image as ImageIcon, Play, Video, Copy, ZoomIn, CheckSquare, Check } from 'lucide-react'
import { useChatStore } from '../stores/chatStore'
import ChatBackground from '../components/ChatBackground'
import MessageContent from '../components/MessageContent'
import { getImageXorKey, getImageAesKey } from '../services/config'
import type { ChatSession, Message } from '../types/models'
import './ChatPage.scss'

interface ChatPageProps {
  // 保留接口以备将来扩展
}

interface SessionDetail {
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

// 头像组件 - 支持骨架屏加载
function SessionAvatar({ session, size = 48 }: { session: ChatSession; size?: number }) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)
  const imgRef = useRef<HTMLImageElement>(null)
  const isGroup = session.username.includes('@chatroom')
  
  const getAvatarLetter = (): string => {
    const name = session.displayName || session.username
    if (!name) return '?'
    const chars = [...name]
    return chars[0] || '?'
  }

  // 当 avatarUrl 变化时重置状态
  useEffect(() => {
    setImageLoaded(false)
    setImageError(false)
  }, [session.avatarUrl])

  // 检查图片是否已经从缓存加载完成
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
      setImageLoaded(true)
    }
  }, [session.avatarUrl])

  const hasValidUrl = session.avatarUrl && !imageError

  return (
    <div 
      className={`session-avatar ${isGroup ? 'group' : ''} ${hasValidUrl && !imageLoaded ? 'loading' : ''}`}
      style={{ width: size, height: size }}
    >
      {hasValidUrl ? (
        <>
          {!imageLoaded && <div className="avatar-skeleton" />}
          <img 
            ref={imgRef}
            src={session.avatarUrl} 
            alt=""
            className={imageLoaded ? 'loaded' : ''}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
          />
        </>
      ) : (
        <span className="avatar-letter">{getAvatarLetter()}</span>
      )}
    </div>
  )
}

function ChatPage(_props: ChatPageProps) {
  const {
    isConnected,
    isConnecting,
    connectionError,
    sessions,
    filteredSessions,
    currentSessionId,
    isLoadingSessions,
    messages,
    isLoadingMessages,
    isLoadingMore,
    hasMoreMessages,
    searchKeyword,
    setConnected,
    setConnecting,
    setConnectionError,
    setSessions,
    setFilteredSessions,
    setCurrentSession,
    setLoadingSessions,
    setMessages,
    appendMessages,
    setLoadingMessages,
    setLoadingMore,
    setHasMoreMessages,
    setSearchKeyword
  } = useChatStore()

  const messageListRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)
  const [currentOffset, setCurrentOffset] = useState(0)
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | undefined>(undefined)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(260)
  const [isResizing, setIsResizing] = useState(false)
  const [showDetailPanel, setShowDetailPanel] = useState(false)
  const [sessionDetail, setSessionDetail] = useState<SessionDetail | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [hasImageKey, setHasImageKey] = useState<boolean | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    message: Message
    session: ChatSession
  } | null>(null)
  const [selectedMessages, setSelectedMessages] = useState<Set<number>>(new Set())
  const [showEnlargeView, setShowEnlargeView] = useState<{ message: Message; content: string } | null>(null)
  const [copyToast, setCopyToast] = useState(false)

  // 检查图片密钥配置（XOR 和 AES 都需要配置）
  useEffect(() => {
    Promise.all([getImageXorKey(), getImageAesKey()]).then(([xorKey, aesKey]) => {
      setHasImageKey(Boolean(xorKey) && Boolean(aesKey))
    })
  }, [])

  // 加载当前用户头像
  const loadMyAvatar = useCallback(async () => {
    try {
      const result = await window.electronAPI.chat.getMyAvatarUrl()
      if (result.success && result.avatarUrl) {
        setMyAvatarUrl(result.avatarUrl)
      }
    } catch (e) {
      console.error('加载用户头像失败:', e)
    }
  }, [])

  // 加载会话详情
  const loadSessionDetail = useCallback(async (sessionId: string) => {
    setIsLoadingDetail(true)
    try {
      const result = await window.electronAPI.chat.getSessionDetail(sessionId)
      if (result.success && result.detail) {
        setSessionDetail(result.detail)
      }
    } catch (e) {
      console.error('加载会话详情失败:', e)
    } finally {
      setIsLoadingDetail(false)
    }
  }, [])

  // 切换详情面板
  const toggleDetailPanel = useCallback(() => {
    if (!showDetailPanel && currentSessionId) {
      loadSessionDetail(currentSessionId)
    }
    setShowDetailPanel(!showDetailPanel)
  }, [showDetailPanel, currentSessionId, loadSessionDetail])

  // 连接数据库
  const connect = useCallback(async () => {
    setConnecting(true)
    setConnectionError(null)
    try {
      const result = await window.electronAPI.chat.connect()
      if (result.success) {
        setConnected(true)
        await loadSessions()
        await loadMyAvatar()
      } else {
        setConnectionError(result.error || '连接失败')
      }
    } catch (e) {
      setConnectionError(String(e))
    } finally {
      setConnecting(false)
    }
  }, [loadMyAvatar])

  // 加载会话列表
  const loadSessions = async () => {
    setLoadingSessions(true)
    try {
      const result = await window.electronAPI.chat.getSessions()
      if (result.success && result.sessions) {
        setSessions(result.sessions)
      }
    } catch (e) {
      console.error('加载会话失败:', e)
    } finally {
      setLoadingSessions(false)
    }
  }

  // 刷新会话列表
  const handleRefresh = async () => {
    await loadSessions()
  }

  // 刷新当前会话消息（清空缓存后重新加载）
  const [isRefreshingMessages, setIsRefreshingMessages] = useState(false)
  const handleRefreshMessages = async () => {
    if (!currentSessionId || isRefreshingMessages) return
    setIsRefreshingMessages(true)
    try {
      // 清空后端缓存
      await window.electronAPI.chat.refreshCache()
      // 重新加载消息
      setCurrentOffset(0)
      await loadMessages(currentSessionId, 0)
    } catch (e) {
      console.error('刷新消息失败:', e)
    } finally {
      setIsRefreshingMessages(false)
    }
  }

  // 加载消息
  const loadMessages = async (sessionId: string, offset = 0) => {
    const listEl = messageListRef.current
    
    if (offset === 0) {
      setLoadingMessages(true)
      setMessages([])
    } else {
      setLoadingMore(true)
    }

    // 记录加载前的第一条消息元素
    const firstMsgEl = listEl?.querySelector('.message-wrapper') as HTMLElement | null

    try {
      const result = await window.electronAPI.chat.getMessages(sessionId, offset, 50)
      if (result.success && result.messages) {
        if (offset === 0) {
          setMessages(result.messages)
          // 首次加载滚动到底部
          requestAnimationFrame(() => {
            if (messageListRef.current) {
              messageListRef.current.scrollTop = messageListRef.current.scrollHeight
            }
          })
        } else {
          appendMessages(result.messages, true)
          // 加载更多后保持位置：让之前的第一条消息保持在原来的视觉位置
          if (firstMsgEl && listEl) {
            requestAnimationFrame(() => {
              listEl.scrollTop = firstMsgEl.offsetTop - 80
            })
          }
        }
        setHasMoreMessages(result.hasMore ?? false)
        setCurrentOffset(offset + result.messages.length)
      }
    } catch (e) {
      console.error('加载消息失败:', e)
    } finally {
      setLoadingMessages(false)
      setLoadingMore(false)
    }
  }

  // 选择会话
  const handleSelectSession = (session: ChatSession) => {
    if (session.username === currentSessionId) {
      // 如果是当前会话，重新加载消息（用于刷新）
      setCurrentOffset(0)
      loadMessages(session.username, 0)
      return
    }
    setCurrentSession(session.username)
    setCurrentOffset(0)
    loadMessages(session.username, 0)
    // 重置详情面板
    setSessionDetail(null)
    if (showDetailPanel) {
      loadSessionDetail(session.username)
    }
  }

  // 搜索过滤
  const handleSearch = (keyword: string) => {
    setSearchKeyword(keyword)
    if (!keyword.trim()) {
      setFilteredSessions(sessions)
      return
    }
    const lower = keyword.toLowerCase()
    const filtered = sessions.filter(s => 
      s.displayName?.toLowerCase().includes(lower) ||
      s.username.toLowerCase().includes(lower) ||
      s.summary.toLowerCase().includes(lower)
    )
    setFilteredSessions(filtered)
  }

  // 关闭搜索框
  const handleCloseSearch = () => {
    setSearchKeyword('')
    setFilteredSessions(sessions)
  }

  // 滚动加载更多 + 显示/隐藏回到底部按钮
  const handleScroll = useCallback(() => {
    if (!messageListRef.current) return
    
    const { scrollTop, clientHeight, scrollHeight } = messageListRef.current
    
    // 显示回到底部按钮：距离底部超过 300px
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    setShowScrollToBottom(distanceFromBottom > 300)
    
    // 预加载：当滚动到顶部 30% 区域时开始加载
    if (!isLoadingMore && hasMoreMessages && currentSessionId) {
      const threshold = clientHeight * 0.3
      if (scrollTop < threshold) {
        loadMessages(currentSessionId, currentOffset)
      }
    }
  }, [isLoadingMore, hasMoreMessages, currentSessionId, currentOffset])

  // 滚动到底部
  const scrollToBottom = useCallback(() => {
    if (messageListRef.current) {
      messageListRef.current.scrollTo({
        top: messageListRef.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [])

  // 拖动调节侧边栏宽度
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    
    const startX = e.clientX
    const startWidth = sidebarWidth
    
    const handleMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - startX
      const newWidth = Math.min(Math.max(startWidth + delta, 200), 400)
      setSidebarWidth(newWidth)
    }
    
    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [sidebarWidth])

  // 初始化连接
  useEffect(() => {
    if (!isConnected && !isConnecting) {
      connect()
    }
  }, [])

  // 点击外部或右键其他地方关闭右键菜单
  useEffect(() => {
    const handleClick = () => {
      if (contextMenu) {
        setContextMenu(null)
      }
    }
    
    const handleContextMenu = () => {
      // 右键其他地方时，先关闭当前菜单
      // 新菜单会在 onContextMenu 处理函数中打开
      if (contextMenu) {
        setContextMenu(null)
      }
    }
    
    if (contextMenu) {
      // 延迟添加事件监听，避免立即触发
      const timer = setTimeout(() => {
        document.addEventListener('click', handleClick)
        document.addEventListener('contextmenu', handleContextMenu)
      }, 0)
      
      return () => {
        clearTimeout(timer)
        document.removeEventListener('click', handleClick)
        document.removeEventListener('contextmenu', handleContextMenu)
      }
    }
  }, [contextMenu])

  // 格式化会话时间（相对时间）- 与原项目一致
  const formatSessionTime = (timestamp: number): string => {
    if (!timestamp) return ''
    
    const now = Date.now()
    const msgTime = timestamp * 1000
    const diff = now - msgTime
    
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    
    // 超过24小时显示日期
    const date = new Date(msgTime)
    const nowDate = new Date()
    
    if (date.getFullYear() === nowDate.getFullYear()) {
      return `${date.getMonth() + 1}/${date.getDate()}`
    }
    
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
  }

  // 获取当前会话信息
  const currentSession = sessions.find(s => s.username === currentSessionId)

  // 判断是否为群聊
  const isGroupChat = (username: string) => username.includes('@chatroom')

  // 渲染日期分隔
  const shouldShowDateDivider = (msg: Message, prevMsg?: Message): boolean => {
    if (!prevMsg) return true
    const date = new Date(msg.createTime * 1000).toDateString()
    const prevDate = new Date(prevMsg.createTime * 1000).toDateString()
    return date !== prevDate
  }

  const formatDateDivider = (timestamp: number): string => {
    const date = new Date(timestamp * 1000)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    
    if (isToday) return '今天'
    
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    if (date.toDateString() === yesterday.toDateString()) return '昨天'
    
    return date.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  return (
    <div className={`chat-page standalone ${isResizing ? 'resizing' : ''}`}>
      {/* 左侧会话列表 */}
      <div 
        className="session-sidebar" 
        ref={sidebarRef}
        style={{ width: sidebarWidth, minWidth: sidebarWidth, maxWidth: sidebarWidth }}
      >
        <div className="session-header">
          <div className="search-row">
            <div className="search-box expanded">
              <Search size={14} />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="搜索"
                value={searchKeyword}
                onChange={(e) => handleSearch(e.target.value)}
              />
              {searchKeyword && (
                <button className="close-search" onClick={handleCloseSearch}>
                  <X size={12} />
                </button>
              )}
            </div>
            <button className="icon-btn refresh-btn" onClick={handleRefresh} disabled={isLoadingSessions}>
              <RefreshCw size={16} className={isLoadingSessions ? 'spin' : ''} />
            </button>
          </div>
        </div>

        {connectionError && (
          <div className="connection-error">
            <AlertCircle size={16} />
            <span>{connectionError}</span>
            <button onClick={connect}>重试</button>
          </div>
        )}

        {isLoadingSessions ? (
          <div className="loading-sessions">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="skeleton-item">
                <div className="skeleton-avatar" />
                <div className="skeleton-content">
                  <div className="skeleton-line" />
                  <div className="skeleton-line" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredSessions.length > 0 ? (
          <div className="session-list">
            {filteredSessions.map(session => (
              <div
                key={session.username}
                className={`session-item ${currentSessionId === session.username ? 'active' : ''}`}
                onClick={() => handleSelectSession(session)}
              >
                <SessionAvatar session={session} size={48} />
                <div className="session-info">
                  <div className="session-top">
                    <span className="session-name">{session.displayName || session.username}</span>
                    <span className="session-time">{formatSessionTime(session.lastTimestamp || session.sortTimestamp)}</span>
                  </div>
                  <div className="session-bottom">
                    <span className="session-summary">
                      {(() => {
                        const summary = session.summary || '暂无消息'
                        const firstLine = summary.split('\n')[0]
                        const hasMoreLines = summary.includes('\n')
                        return (
                          <>
                            <MessageContent content={firstLine} />
                            {hasMoreLines && <span>...</span>}
                          </>
                        )
                      })()}
                    </span>
                    {session.unreadCount > 0 && (
                      <span className="unread-badge">
                        {session.unreadCount > 99 ? '99+' : session.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-sessions">
            <MessageSquare />
            <p>暂无会话</p>
            <p className="hint">请先在数据管理页面解密数据库</p>
          </div>
        )}
      </div>

      {/* 拖动调节条 */}
      <div className="resize-handle" onMouseDown={handleResizeStart} />

      {/* 右侧消息区域 */}
      <div className="message-area">
        {currentSession ? (
          <>
            <div className="message-header">
              <SessionAvatar session={currentSession} size={40} />
              <div className="header-info">
                <h3>{currentSession.displayName || currentSession.username}</h3>
                {isGroupChat(currentSession.username) && (
                  <div className="header-subtitle">群聊</div>
                )}
              </div>
              <div className="header-actions">
                <button 
                  className="icon-btn refresh-messages-btn" 
                  onClick={handleRefreshMessages} 
                  disabled={isRefreshingMessages || isLoadingMessages}
                  title="刷新消息"
                >
                  <RefreshCw size={18} className={isRefreshingMessages ? 'spin' : ''} />
                </button>
                <button 
                  className={`icon-btn detail-btn ${showDetailPanel ? 'active' : ''}`}
                  onClick={toggleDetailPanel}
                  title="会话详情"
                >
                  <Info size={18} />
                </button>
              </div>
            </div>

            <div className="message-content-wrapper">
              {isLoadingMessages ? (
                <div className="loading-messages">
                  <Loader2 size={24} />
                  <span>加载消息中...</span>
                </div>
              ) : (
                <div 
                  className="message-list" 
                  ref={messageListRef}
                  onScroll={handleScroll}
                >
                  <ChatBackground />
                  {hasMoreMessages && (
                    <div className={`load-more-trigger ${isLoadingMore ? 'loading' : ''}`}>
                      {isLoadingMore ? (
                        <>
                          <Loader2 size={14} />
                          <span>加载更多...</span>
                        </>
                      ) : (
                        <span>向上滚动加载更多</span>
                      )}
                    </div>
                  )}

                  {messages.map((msg, index) => {
                    const prevMsg = index > 0 ? messages[index - 1] : undefined
                  const showDateDivider = shouldShowDateDivider(msg, prevMsg)
                  
                  // 显示时间：第一条消息，或者与上一条消息间隔超过5分钟
                  const showTime = !prevMsg || (msg.createTime - prevMsg.createTime > 300)
                  const isSent = msg.isSend === 1
                  const isSystem = msg.localType === 10000
                  
                  // 系统消息居中显示
                  const wrapperClass = isSystem ? 'system' : (isSent ? 'sent' : 'received')
                  
                  return (
                    <div key={msg.localId} className={`message-wrapper ${wrapperClass}`}>
                      {showDateDivider && (
                        <div className="date-divider">
                          <span>{formatDateDivider(msg.createTime)}</span>
                        </div>
                      )}
                      <MessageBubble 
                        message={msg} 
                        session={currentSession} 
                        showTime={!showDateDivider && showTime}
                        myAvatarUrl={myAvatarUrl}
                        isGroupChat={isGroupChat(currentSession.username)}
                        hasImageKey={hasImageKey === true}
                        onContextMenu={(e, message) => {
                          // 只对文本消息显示右键菜单
                          const isSystem = message.localType === 10000
                          const isEmoji = message.localType === 47
                          const isImage = message.localType === 3
                          const isVideo = message.localType === 43
                          
                          // 只有普通文本消息才显示右键菜单
                          if (isSystem || isEmoji || isImage || isVideo) {
                            return
                          }
                          
                          e.preventDefault()
                          e.stopPropagation()
                          
                          // 计算菜单位置，确保不超出屏幕
                          const menuWidth = 160
                          const menuHeight = 120
                          let x = e.clientX
                          let y = e.clientY
                          
                          if (x + menuWidth > window.innerWidth) {
                            x = window.innerWidth - menuWidth - 10
                          }
                          if (y + menuHeight > window.innerHeight) {
                            y = window.innerHeight - menuHeight - 10
                          }
                          
                          // 直接设置新菜单，React 会自动处理状态更新
                          setContextMenu({
                            x,
                            y,
                            message,
                            session: currentSession
                          })
                        }}
                        isSelected={selectedMessages.has(msg.localId)}
                      />
                    </div>
                  )
                })}

                {/* 回到底部按钮 */}
                <div className={`scroll-to-bottom ${showScrollToBottom ? 'show' : ''}`} onClick={scrollToBottom}>
                  <ChevronDown size={16} />
                  <span>回到底部</span>
                </div>
              </div>
              )}

              {/* 会话详情面板 */}
              {showDetailPanel && (
                <div className="detail-panel">
                  <div className="detail-header">
                    <h4>会话详情</h4>
                    <button className="close-btn" onClick={() => setShowDetailPanel(false)}>
                      <X size={16} />
                    </button>
                  </div>
                  {isLoadingDetail ? (
                    <div className="detail-loading">
                      <Loader2 size={20} className="spin" />
                      <span>加载中...</span>
                    </div>
                  ) : sessionDetail ? (
                    <div className="detail-content">
                      <div className="detail-section">
                        <div className="detail-item">
                          <Hash size={14} />
                          <span className="label">微信ID</span>
                          <span className="value">{sessionDetail.wxid}</span>
                        </div>
                        {sessionDetail.remark && (
                          <div className="detail-item">
                            <span className="label">备注</span>
                            <span className="value">{sessionDetail.remark}</span>
                          </div>
                        )}
                        {sessionDetail.nickName && (
                          <div className="detail-item">
                            <span className="label">昵称</span>
                            <span className="value">{sessionDetail.nickName}</span>
                          </div>
                        )}
                        {sessionDetail.alias && (
                          <div className="detail-item">
                            <span className="label">微信号</span>
                            <span className="value">{sessionDetail.alias}</span>
                          </div>
                        )}
                      </div>

                      <div className="detail-section">
                        <div className="section-title">
                          <MessageSquare size={14} />
                          <span>消息统计</span>
                        </div>
                        <div className="detail-item">
                          <span className="label">消息总数</span>
                          <span className="value highlight">{sessionDetail.messageCount.toLocaleString()}</span>
                        </div>
                        {sessionDetail.firstMessageTime && (
                          <div className="detail-item">
                            <Calendar size={14} />
                            <span className="label">首条消息</span>
                            <span className="value">{new Date(sessionDetail.firstMessageTime * 1000).toLocaleDateString('zh-CN')}</span>
                          </div>
                        )}
                        {sessionDetail.latestMessageTime && (
                          <div className="detail-item">
                            <Calendar size={14} />
                            <span className="label">最新消息</span>
                            <span className="value">{new Date(sessionDetail.latestMessageTime * 1000).toLocaleDateString('zh-CN')}</span>
                          </div>
                        )}
                      </div>

                      {sessionDetail.messageTables.length > 0 && (
                        <div className="detail-section">
                          <div className="section-title">
                            <Database size={14} />
                            <span>数据库分布</span>
                          </div>
                          <div className="table-list">
                            {sessionDetail.messageTables.map((t, i) => (
                              <div key={i} className="table-item">
                                <span className="db-name">{t.dbName}</span>
                                <span className="table-count">{t.count.toLocaleString()} 条</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="detail-empty">暂无详情</div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="message-header empty-header">
              <div className="header-info">
                <h3>聊天</h3>
              </div>
            </div>
            <div className="message-content-wrapper">
              <div className="message-list">
                <ChatBackground />
                <div className="empty-chat">
                  <MessageSquare />
                  <p>选择一个会话开始查看聊天记录</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 右键菜单 */}
      {contextMenu && createPortal(
        <div 
          className="context-menu-overlay" 
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            // 右键菜单外部时关闭菜单
            setContextMenu(null)
          }}
        >
          <div 
            className="context-menu"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
          >
            <div 
              className="context-menu-item"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(contextMenu.message.parsedContent || '')
                  setContextMenu(null)
                  setCopyToast(true)
                  setTimeout(() => setCopyToast(false), 2000)
                } catch (e) {
                  console.error('复制失败:', e)
                  setContextMenu(null)
                }
              }}
            >
              <Copy size={16} />
              <span>复制</span>
            </div>
            <div 
              className="context-menu-item"
              onClick={() => {
                setShowEnlargeView({
                  message: contextMenu.message,
                  content: contextMenu.message.parsedContent || ''
                })
                setContextMenu(null)
              }}
            >
              <ZoomIn size={16} />
              <span>放大阅读</span>
            </div>
            <div 
              className="context-menu-item"
              onClick={() => {
                setSelectedMessages(prev => {
                  const newSet = new Set(prev)
                  if (newSet.has(contextMenu.message.localId)) {
                    newSet.delete(contextMenu.message.localId)
                  } else {
                    newSet.add(contextMenu.message.localId)
                  }
                  return newSet
                })
                setContextMenu(null)
              }}
            >
              <CheckSquare size={16} />
              <span>多选</span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 放大阅读弹窗 */}
      {showEnlargeView && createPortal(
        <div className="enlarge-view-overlay" onClick={() => setShowEnlargeView(null)}>
          <div className="enlarge-view-content" onClick={(e) => e.stopPropagation()}>
            <div className="enlarge-view-header">
              <h3>放大阅读</h3>
              <button className="close-btn" onClick={() => setShowEnlargeView(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="enlarge-view-body">
              <MessageContent content={showEnlargeView.content} />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 复制成功提示 */}
      {copyToast && createPortal(
        <div className="copy-toast">
          <Check size={16} />
          <span>已复制</span>
        </div>,
        document.body
      )}
    </div>
  )
}

// 前端表情包缓存
const emojiDataUrlCache = new Map<string, string>()
// 前端图片缓存
const imageDataUrlCache = new Map<string, string>()

// 图片解密队列管理
const imageDecryptQueue: Array<() => Promise<void>> = []
let isProcessingQueue = false
const MAX_CONCURRENT_DECRYPTS = 3

async function processDecryptQueue() {
  if (isProcessingQueue) return
  isProcessingQueue = true
  
  try {
    while (imageDecryptQueue.length > 0) {
      const batch = imageDecryptQueue.splice(0, MAX_CONCURRENT_DECRYPTS)
      await Promise.all(batch.map(fn => fn().catch(() => {})))
    }
  } finally {
    isProcessingQueue = false
  }
}

function enqueueDecrypt(fn: () => Promise<void>) {
  imageDecryptQueue.push(fn)
  void processDecryptQueue()
}

  // 视频信息缓存
  const videoInfoCache = new Map<string, { videoUrl?: string; coverUrl?: string; thumbUrl?: string; exists: boolean }>()

// 消息气泡组件
function MessageBubble({ message, session, showTime, myAvatarUrl, isGroupChat, hasImageKey, onContextMenu, isSelected }: { 
  message: Message; 
  session: ChatSession; 
  showTime?: boolean;
  myAvatarUrl?: string;
  isGroupChat?: boolean;
  hasImageKey?: boolean;
  onContextMenu?: (e: React.MouseEvent, message: Message) => void;
  isSelected?: boolean;
}) {
  const isSystem = message.localType === 10000
  const isEmoji = message.localType === 47
  const isImage = message.localType === 3
  const isVideo = message.localType === 43
  const isSent = message.isSend === 1
  const [senderAvatarUrl, setSenderAvatarUrl] = useState<string | undefined>(undefined)
  const [senderName, setSenderName] = useState<string | undefined>(undefined)
  const [emojiError, setEmojiError] = useState(false)
  const [emojiLoading, setEmojiLoading] = useState(false)
  const [imageError, setImageError] = useState(false)
  const [imageLoading, setImageLoading] = useState(false)
  const [imageHasUpdate, setImageHasUpdate] = useState(false)
  const [imageClicked, setImageClicked] = useState(false)
  const [imageNoHd, setImageNoHd] = useState(false)  // 没有高清图
  const imageUpdateCheckedRef = useRef<string | null>(null)
  const imageClickTimerRef = useRef<number | null>(null)
  const [showImagePreview, setShowImagePreview] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const imageContainerRef = useRef<HTMLDivElement>(null)
  
  // 视频相关状态
  const [videoInfo, setVideoInfo] = useState<{ videoUrl?: string; coverUrl?: string; thumbUrl?: string; exists: boolean } | null>(null)
  const [videoLoading, setVideoLoading] = useState(false)
  const [videoPlaying, setVideoPlaying] = useState(false)
  const [videoEnded, setVideoEnded] = useState(false)
  const [videoDataUrl, setVideoDataUrl] = useState<string | null>(null)
  const [videoDataLoading, setVideoDataLoading] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)
  
  // 从缓存获取表情包 data URL
  const cacheKey = message.emojiMd5 || message.emojiCdnUrl || ''
  const [emojiLocalPath, setEmojiLocalPath] = useState<string | undefined>(
    () => emojiDataUrlCache.get(cacheKey)
  )
  
  // 图片缓存
  const imageCacheKey = message.imageMd5 || message.imageDatName || `local:${message.localId}`
  const [imageLocalPath, setImageLocalPath] = useState<string | undefined>(
    () => imageDataUrlCache.get(imageCacheKey)
  )
  
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }) + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  // 获取头像首字母
  const getAvatarLetter = (name: string): string => {
    if (!name) return '?'
    const chars = [...name]
    return chars[0] || '?'
  }

  // 下载表情包
  const downloadEmoji = () => {
    if (!message.emojiCdnUrl || emojiLoading) return
    
    // 先检查缓存
    const cached = emojiDataUrlCache.get(cacheKey)
    if (cached) {
      setEmojiLocalPath(cached)
      setEmojiError(false)
      return
    }
    
    setEmojiLoading(true)
    setEmojiError(false)
    window.electronAPI.chat.downloadEmoji(message.emojiCdnUrl, message.emojiMd5).then((result: { success: boolean; localPath?: string; error?: string }) => {
      if (result.success && result.localPath) {
        emojiDataUrlCache.set(cacheKey, result.localPath)
        setEmojiLocalPath(result.localPath)
      } else {
        setEmojiError(true)
      }
    }).catch(() => {
      setEmojiError(true)
    }).finally(() => {
      setEmojiLoading(false)
    })
  }

  // 请求图片解密
  const requestImageDecrypt = useCallback(async (forceUpdate = false) => {
    if (!isImage || imageLoading) return
    setImageLoading(true)
    setImageError(false)
    if (forceUpdate) {
      setImageNoHd(false)  // 重置状态
    }
    try {
      if (message.imageMd5 || message.imageDatName) {
        const result = await window.electronAPI.image.decrypt({
          sessionId: session.username,
          imageMd5: message.imageMd5 || undefined,
          imageDatName: message.imageDatName,
          force: forceUpdate
        })
        
        // 先检查错误情况
        if (!result.success) {
          // 如果是请求高清图失败，标记没有高清图
          if (forceUpdate && result.error?.includes('未找到高清图')) {
            setImageNoHd(true)
            return
          }
          setImageError(true)
          return
        }
        
        // 成功情况
        if (result.localPath) {
          imageDataUrlCache.set(imageCacheKey, result.localPath)
          setImageLocalPath(result.localPath)
          // 如果返回的是缩略图，标记有更新可用
          setImageHasUpdate(Boolean((result as { isThumb?: boolean }).isThumb))
          setImageNoHd(false)
          return
        }
      }
      setImageError(true)
    } catch {
      setImageError(true)
    } finally {
      setImageLoading(false)
    }
  }, [isImage, imageLoading, message.imageMd5, message.imageDatName, session.username, imageCacheKey])

  // 点击图片解密
  const handleImageClick = useCallback(() => {
    if (imageClickTimerRef.current) {
      window.clearTimeout(imageClickTimerRef.current)
    }
    setImageClicked(true)
    imageClickTimerRef.current = window.setTimeout(() => {
      setImageClicked(false)
    }, 800)
    void requestImageDecrypt()
  }, [requestImageDecrypt])

  // 清理定时器
  useEffect(() => {
    return () => {
      if (imageClickTimerRef.current) {
        window.clearTimeout(imageClickTimerRef.current)
      }
    }
  }, [])

  // 使用 IntersectionObserver 检测图片是否进入可视区域（懒加载）
  useEffect(() => {
    if (!isImage || !imageContainerRef.current) return
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '200px 0px', // 提前 200px 开始加载
        threshold: 0
      }
    )
    
    observer.observe(imageContainerRef.current)
    
    return () => observer.disconnect()
  }, [isImage])

  // 视频懒加载
  useEffect(() => {
    if (!isVideo || !videoContainerRef.current) return
    
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true)
            observer.disconnect()
          }
        })
      },
      {
        rootMargin: '200px 0px',
        threshold: 0
      }
    )
    
    observer.observe(videoContainerRef.current)
    
    return () => observer.disconnect()
  }, [isVideo])

  // 加载视频信息
  useEffect(() => {
    if (!isVideo || !isVisible || videoInfo || videoLoading) return
    if (!message.videoMd5) return
    
    // 先检查缓存
    const cached = videoInfoCache.get(message.videoMd5)
    if (cached) {
      setVideoInfo(cached)
      return
    }
    
    setVideoLoading(true)
    window.electronAPI.video.getVideoInfo(message.videoMd5).then((result) => {
      if (result && result.success) {
        const info = {
          exists: result.exists,
          videoUrl: result.videoUrl,
          coverUrl: result.coverUrl,
          thumbUrl: result.thumbUrl
        }
        videoInfoCache.set(message.videoMd5!, info)
        setVideoInfo(info)
      } else {
        setVideoInfo({ exists: false })
      }
    }).catch(() => {
      setVideoInfo({ exists: false })
    }).finally(() => {
      setVideoLoading(false)
    })
  }, [isVideo, isVisible, videoInfo, videoLoading, message.videoMd5])

  // 播放视频
  const handlePlayVideo = useCallback(async () => {
    if (!videoInfo?.videoUrl) return
    
    // 如果已有视频数据，直接播放
    if (videoDataUrl) {
      setVideoPlaying(true)
      setVideoEnded(false)
      requestAnimationFrame(() => {
        videoRef.current?.play()
      })
      return
    }
    
    // 加载视频数据（videoUrl 现在是文件路径）
    setVideoDataLoading(true)
    try {
      const result = await window.electronAPI.video.readFile(videoInfo.videoUrl)
      if (result.success && result.data) {
        setVideoDataUrl(result.data)
        setVideoPlaying(true)
        setVideoEnded(false)
        requestAnimationFrame(() => {
          videoRef.current?.play()
        })
      }
    } catch {
      // 忽略错误
    } finally {
      setVideoDataLoading(false)
    }
  }, [videoInfo?.videoUrl, videoDataUrl])

  // 视频播放结束
  const handleVideoEnded = useCallback(() => {
    setVideoPlaying(false)
    setVideoEnded(true)
  }, [])

  // 群聊中获取发送者信息
  useEffect(() => {
    if (isGroupChat && !isSent && message.senderUsername) {
      window.electronAPI.chat.getContactAvatar(message.senderUsername).then((result: { avatarUrl?: string; displayName?: string } | null) => {
        if (result) {
          setSenderAvatarUrl(result.avatarUrl)
          setSenderName(result.displayName)
        }
      }).catch(() => {})
    }
  }, [isGroupChat, isSent, message.senderUsername])

  // 自动下载表情包
  useEffect(() => {
    if (emojiLocalPath) return
    if (isEmoji && message.emojiCdnUrl && !emojiLoading && !emojiError) {
      downloadEmoji()
    }
  }, [isEmoji, message.emojiCdnUrl, emojiLocalPath, emojiLoading, emojiError])

  // 自动尝试从缓存解析图片，如果没有缓存则自动解密（仅在可见时触发，5秒超时）
  useEffect(() => {
    if (!isImage) return
    if (!message.imageMd5 && !message.imageDatName) return
    if (!isVisible) return  // 只有可见时才加载
    if (imageUpdateCheckedRef.current === imageCacheKey) return
    if (imageLocalPath) return  // 如果已经有本地路径，不需要再解析
    if (imageLoading) return  // 已经在加载中
    
    imageUpdateCheckedRef.current = imageCacheKey
    
    let cancelled = false
    let timeoutId: number | null = null
    
    const doDecrypt = async () => {
      // 设置 5 秒超时
      const timeoutPromise = new Promise<{ timeout: true }>((resolve) => {
        timeoutId = window.setTimeout(() => resolve({ timeout: true }), 5000)
      })
      
      const decryptPromise = (async () => {
        // 先尝试从缓存获取
        try {
          const result = await window.electronAPI.image.resolveCache({
            sessionId: session.username,
            imageMd5: message.imageMd5 || undefined,
            imageDatName: message.imageDatName
          })
          if (cancelled) return { cancelled: true }
          if (result.success && result.localPath) {
            return { success: true, localPath: result.localPath, hasUpdate: result.hasUpdate }
          }
        } catch {
          // 继续尝试解密
        }
        
        if (cancelled) return { cancelled: true }
        
        // 缓存中没有，自动尝试解密
        try {
          const decryptResult = await window.electronAPI.image.decrypt({
            sessionId: session.username,
            imageMd5: message.imageMd5 || undefined,
            imageDatName: message.imageDatName,
            force: false
          })
          if (cancelled) return { cancelled: true }
          if (decryptResult.success && decryptResult.localPath) {
            return { success: true, localPath: decryptResult.localPath }
          }
        } catch {
          // 解密失败
        }
        return { failed: true }
      })()
      
      setImageLoading(true)
      const result = await Promise.race([decryptPromise, timeoutPromise])
      
      if (timeoutId) {
        window.clearTimeout(timeoutId)
        timeoutId = null
      }
      
      if (cancelled) return
      
      if ('timeout' in result) {
        // 超时，显示手动解密按钮
        setImageError(true)
        setImageLoading(false)
        return
      }
      
      if ('cancelled' in result) return
      
      if ('success' in result && result.localPath) {
        imageDataUrlCache.set(imageCacheKey, result.localPath)
        setImageLocalPath(result.localPath)
        setImageError(false)
        if ('hasUpdate' in result) {
          setImageHasUpdate(Boolean(result.hasUpdate))
        }
      } else {
        setImageError(true)
      }
      setImageLoading(false)
    }
    
    // 使用队列控制并发
    enqueueDecrypt(doDecrypt)
    
    return () => {
      cancelled = true
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [isImage, imageLocalPath, message.imageMd5, message.imageDatName, imageCacheKey, session.username, isVisible])

  // 监听图片更新事件
  useEffect(() => {
    if (!isImage) return
    const unsubscribe = window.electronAPI.image.onUpdateAvailable((payload) => {
      const matchesCacheKey =
        payload.cacheKey === message.imageMd5 ||
        payload.cacheKey === message.imageDatName ||
        (payload.imageMd5 && payload.imageMd5 === message.imageMd5) ||
        (payload.imageDatName && payload.imageDatName === message.imageDatName)
      if (matchesCacheKey) {
        setImageHasUpdate(true)
      }
    })
    return () => {
      unsubscribe?.()
    }
  }, [isImage, message.imageDatName, message.imageMd5])

  // 监听缓存解析事件
  useEffect(() => {
    if (!isImage) return
    const unsubscribe = window.electronAPI.image.onCacheResolved((payload) => {
      const matchesCacheKey =
        payload.cacheKey === message.imageMd5 ||
        payload.cacheKey === message.imageDatName ||
        (payload.imageMd5 && payload.imageMd5 === message.imageMd5) ||
        (payload.imageDatName && payload.imageDatName === message.imageDatName)
      if (matchesCacheKey) {
        imageDataUrlCache.set(imageCacheKey, payload.localPath)
        setImageLocalPath(payload.localPath)
        setImageError(false)
      }
    })
    return () => {
      unsubscribe?.()
    }
  }, [isImage, imageCacheKey, message.imageDatName, message.imageMd5])

  if (isSystem) {
    return (
      <div className="message-bubble system">
        <div className="bubble-content"><MessageContent content={message.parsedContent} /></div>
      </div>
    )
  }

  const bubbleClass = isSent ? 'sent' : 'received'
  
  // 头像逻辑：
  // - 自己发的：使用 myAvatarUrl
  // - 群聊中对方发的：使用发送者头像
  // - 私聊中对方发的：使用会话头像
  const avatarUrl = isSent 
    ? myAvatarUrl 
    : (isGroupChat ? senderAvatarUrl : session.avatarUrl)
  const avatarLetter = isSent 
    ? '我' 
    : getAvatarLetter(isGroupChat ? (senderName || message.senderUsername || '?') : (session.displayName || session.username))

  // 是否有引用消息
  const hasQuote = message.quotedContent && message.quotedContent.length > 0

  // 渲染消息内容
  const renderContent = () => {
    // 图片消息
    if (isImage) {
      // 没有配置密钥时显示提示（优先级最高）
      if (hasImageKey === false) {
        return (
          <div className="image-no-key" ref={imageContainerRef}>
            <ImageIcon size={24} />
            <span>请配置图片解密密钥</span>
          </div>
        )
      }
      
      // 已有缓存图片，直接显示
      if (imageLocalPath) {
        return (
          <>
            <div className="image-message-wrapper" ref={imageContainerRef}>
              <img
                src={imageLocalPath}
                alt="图片"
                className="image-message"
                onClick={() => {
                  void requestImageDecrypt(true)
                  setShowImagePreview(true)
                }}
                onLoad={() => setImageError(false)}
                onError={() => setImageError(true)}
              />
              {imageLoading && (
                <div className="image-loading-overlay">
                  <Loader2 size={20} className="spin" />
                </div>
              )}
            </div>
            {showImagePreview && createPortal(
              <div className="image-preview-overlay" onClick={() => setShowImagePreview(false)}>
                {imageNoHd ? (
                  <div className="image-preview-no-hd" onClick={(e) => e.stopPropagation()}>
                    <ImageIcon size={64} />
                    <p>未找到高清图</p>
                    <span>请在微信中点开该图片查看后重试</span>
                  </div>
                ) : (
                  <img src={imageLocalPath} alt="图片预览" onClick={(e) => e.stopPropagation()} />
                )}
              </div>,
              document.body
            )}
          </>
        )
      }
      
      // 未进入可视区域时显示占位符
      if (!isVisible) {
        return (
          <div className="image-placeholder" ref={imageContainerRef}>
            <ImageIcon size={24} />
          </div>
        )
      }
      
      if (imageLoading) {
        return (
          <div className="image-loading" ref={imageContainerRef}>
            <Loader2 size={20} className="spin" />
          </div>
        )
      }
      
      // 解密失败或未解密
      return (
        <button
          className={`image-unavailable ${imageClicked ? 'clicked' : ''}`}
          onClick={handleImageClick}
          disabled={imageLoading}
          type="button"
          ref={imageContainerRef as unknown as React.RefObject<HTMLButtonElement>}
        >
          <ImageIcon size={24} />
          <span>图片未解密</span>
          <span className="image-action">{imageClicked ? '已点击…' : '点击解密'}</span>
        </button>
      )
    }
    
    // 视频消息
    if (isVideo) {
      // 未进入可视区域时显示占位符
      if (!isVisible) {
        return (
          <div className="video-placeholder" ref={videoContainerRef}>
            <Video size={24} />
          </div>
        )
      }
      
      // 加载中
      if (videoLoading) {
        return (
          <div className="video-loading" ref={videoContainerRef}>
            <Loader2 size={20} className="spin" />
          </div>
        )
      }
      
      // 视频不存在
      if (!videoInfo?.exists || !videoInfo.videoUrl) {
        return (
          <div className="video-unavailable" ref={videoContainerRef}>
            <Video size={24} />
            <span>视频不可用</span>
          </div>
        )
      }
      
      // 默认显示缩略图，点击打开全屏播放器
      const thumbSrc = videoInfo.thumbUrl || videoInfo.coverUrl
      return (
        <>
          <div className="video-thumb-wrapper" ref={videoContainerRef} onClick={handlePlayVideo}>
            {thumbSrc ? (
              <img src={thumbSrc} alt="视频缩略图" className="video-thumb" />
            ) : (
              <div className="video-thumb-placeholder">
                <Video size={32} />
              </div>
            )}
            <div className="video-play-button">
              {videoDataLoading ? (
                <Loader2 size={32} className="spin" />
              ) : (
                <Play size={32} fill="white" />
              )}
            </div>
          </div>
          {videoPlaying && videoDataUrl && createPortal(
            <div className="video-preview-overlay" onClick={() => setVideoPlaying(false)}>
              <video
                ref={videoRef}
                src={videoDataUrl}
                className="video-preview-player"
                controls
                autoPlay
                controlsList="nodownload nofullscreen noplaybackrate"
                disablePictureInPicture
                onClick={(e) => e.stopPropagation()}
                onError={() => setVideoPlaying(false)}
              />
            </div>,
            document.body
          )}
        </>
      )
    }
    
    // 表情包消息
    if (isEmoji) {
      // 没有 cdnUrl 或加载失败，显示占位符
      if (!message.emojiCdnUrl || emojiError) {
        return (
          <div className="emoji-unavailable">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 15s1.5 2 4 2 4-2 4-2"/>
              <line x1="9" y1="9" x2="9.01" y2="9"/>
              <line x1="15" y1="9" x2="15.01" y2="9"/>
            </svg>
            <span>表情包未缓存</span>
          </div>
        )
      }
      
      // 显示加载中
      if (emojiLoading || !emojiLocalPath) {
        return (
          <div className="emoji-loading">
            <Loader2 size={20} className="spin" />
          </div>
        )
      }
      
      // 显示表情图片
      return (
        <img 
          src={emojiLocalPath} 
          alt="表情"
          className="emoji-image"
          onError={() => setEmojiError(true)}
        />
      )
    }
    // 带引用的消息
    if (hasQuote) {
      return (
        <div className="bubble-content">
          <div className="quoted-message">
            {message.quotedSender && <span className="quoted-sender">{message.quotedSender}</span>}
            <span className="quoted-text">{message.quotedContent}</span>
          </div>
          <div className="message-text"><MessageContent content={message.parsedContent} /></div>
        </div>
      )
    }
    // 普通消息
    return <div className="bubble-content"><MessageContent content={message.parsedContent} /></div>
  }

  return (
    <>
      {showTime && (
        <div className="time-divider">
          <span>{formatTime(message.createTime)}</span>
        </div>
      )}
      <div 
        className={`message-bubble ${bubbleClass} ${isEmoji && message.emojiCdnUrl && !emojiError ? 'emoji' : ''} ${isImage ? 'image' : ''} ${isVideo ? 'video' : ''} ${isSelected ? 'selected' : ''}`}
        onContextMenu={(e) => {
          if (onContextMenu) {
            onContextMenu(e, message)
          }
        }}
      >
        <div className="bubble-avatar">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" />
          ) : (
            <span className="avatar-letter">{avatarLetter}</span>
          )}
        </div>
        <div className="bubble-body">
          {/* 群聊中显示发送者名称 */}
          {isGroupChat && !isSent && (
            <div className="sender-name">
              {senderName || message.senderUsername || '群成员'}
            </div>
          )}
          {renderContent()}
        </div>
      </div>
    </>
  )
}

export default ChatPage
