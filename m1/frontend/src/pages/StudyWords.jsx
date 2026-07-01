import { useState, useEffect, useCallback, useRef } from 'react'
import { getUserWords, reviewWord, getSettings, createStudySession, checkIn, getTodayCheckIn } from '../services/api'
import { playPronunciation, playSentence } from '../utils/audioPlayer'

function StudyWords() {
  // --- 状态 ---
  const [queue, setQueue] = useState([])           // 单词队列
  const [currentIndex, setCurrentIndex] = useState(0) // 当前单词索引
  const [isFlipped, setIsFlipped] = useState(false)   // 卡片翻转状态
  const [isComplete, setIsComplete] = useState(false)  // 是否完成所有任务
  const [completedCount, setCompletedCount] = useState(0) // 已完成单词数
  const [settings, setSettings] = useState({ daily_new_words: 10, daily_review_target: 20 })

  // 统计
  const [newRemaining, setNewRemaining] = useState(0)     // 新词剩余
  const [reviewRemaining, setReviewRemaining] = useState(0) // 复习剩余
  const [studyStartTime] = useState(() => Date.now())       // 页面进入时间
  const [elapsedSeconds, setElapsedSeconds] = useState(0)   // 已过秒数
  const [checkedIn, setCheckedIn] = useState(false)         // 今日已打卡
  const [checkingIn, setCheckingIn] = useState(false)       // 打卡中

  // refs
  const timerRef = useRef(null)
  const cardTimerRef = useRef(null)
  const statsRef = useRef({ completedCount: 0, elapsedSeconds: 0 }) // 实时统计快照
  const sessionSavedRef = useRef(false) // 防止重复保存

  // --- 计时器 ---
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - studyStartTime) / 1000))
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [studyStartTime])

  // --- 同步 statsRef（供离开时快照用） ---
  useEffect(() => {
    statsRef.current = { completedCount, elapsedSeconds }
  }, [completedCount, elapsedSeconds])

  // --- 自动保存学习记录（每30秒 + 卸载时） ---
  useEffect(() => {
    const doSave = (isFinal = false) => {
      const { completedCount: c, elapsedSeconds: s } = statsRef.current
      if (s < 5 && c === 0) return

      const payload = { duration_seconds: s, word_count: c }
      console.log('[StudyWords] Saving session:', payload, isFinal ? '(final)' : '(auto)')

      // 使用 fetch + keepalive 确保请求能完成
      fetch('/api/study-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(err => console.error('保存学习记录失败:', err))
    }

    // 每30秒自动保存一次
    const autoSaveInterval = setInterval(() => {
      doSave(false)
    }, 30000)

    // 页面关闭前保存
    const handleBeforeUnload = () => doSave(true)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      clearInterval(autoSaveInterval)
      doSave(true) // 组件卸载时保存
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [])

  // --- 加载单词 ---
  useEffect(() => {
    loadStudyData()
  }, [])

  const loadStudyData = async () => {
    try {
      // 并行加载：设置、今日打卡、新词、待复习词
      const [settingsData, checkInData] = await Promise.all([
        getSettings().catch(() => ({ daily_new_words: 10, daily_review_target: 20 })),
        getTodayCheckIn().catch(() => ({ checked_in: false }))
      ])

      setSettings(settingsData)
      setCheckedIn(checkInData.checked_in || false)

      const dailyNew = settingsData.daily_new_words || 10

      const [newWords, reviewWords] = await Promise.all([
        getUserWords({ status: 'new', limit: dailyNew }),
        getUserWords({ status: 'learning', due: true })
      ])

      // 构建队列：待复习(按日期排序) + 新词
      const combined = [
        ...reviewWords,
        ...newWords
      ]

      setNewRemaining(newWords.length)
      setReviewRemaining(reviewWords.length)
      setQueue(combined)
      setIsComplete(combined.length === 0)

    } catch (error) {
      console.error('加载学习数据失败:', error)
    }
  }

  // --- 工具函数 ---
  const today = () => new Date().toISOString().split('T')[0]

  const addDays = (dateStr, days) => {
    const d = new Date(dateStr)
    d.setDate(d.getDate() + days)
    return d.toISOString().split('T')[0]
  }

  // 移除队列中的某个单词（用于"认识"）
  const removeFromQueue = useCallback((index) => {
    setQueue(prev => {
      const next = [...prev]
      next.splice(index, 1)
      return next
    })
  }, [])

  // 将单词移到队列末尾（用于"模糊"）
  const moveToEnd = useCallback((index) => {
    setQueue(prev => {
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.push(item)
      return next
    })
  }, [])

  // 将单词插回当前位置之后（用于"不认识"）
  const reinsertAfter = useCallback((index) => {
    setQueue(prev => {
      const next = [...prev]
      const [item] = next.splice(index, 1)
      // 插到当前之后第 2 个位置，避免立刻又出现
      const insertAt = Math.min(index + 2, next.length)
      next.splice(insertAt, 0, item)
      return next
    })
  }, [])

  // --- 答题处理 ---
  const handleAnswer = useCallback(async (action) => {
    const word = queue[currentIndex]
    if (!word) return

    // 翻转回正面
    setIsFlipped(false)

    let nextReviewDate
    let status

    switch (action) {
      case 'know': // 认识 → mastered
        status = 'mastered'
        nextReviewDate = addDays(today(), 3)
        break
      case 'fuzzy': // 模糊 → learning, 明天复习
        status = 'learning'
        nextReviewDate = addDays(today(), 1)
        break
      case 'unknown': // 不认识 → learning, 当天再出
        status = 'learning'
        nextReviewDate = today()
        break
    }

    // 调用 API
    try {
      await reviewWord(word.id, status, nextReviewDate)
    } catch (err) {
      console.error('更新单词状态失败:', err)
    }

    // 更新本地统计
    if (action === 'know') {
      setCompletedCount(c => c + 1)
      // 更新剩余计数
      if (word.status === 'new' || !word.status) {
        setNewRemaining(n => Math.max(0, n - 1))
      } else if (word.status === 'learning') {
        setReviewRemaining(r => Math.max(0, r - 1))
      }
      // 从队列移除
      removeFromQueue(currentIndex)
    } else if (action === 'fuzzy') {
      // 移到末尾
      moveToEnd(currentIndex)
    } else if (action === 'unknown') {
      // 插回当前位置之后
      reinsertAfter(currentIndex)
    }

    // 短暂延迟后展示下一个（让用户看到翻转回归）
    clearTimeout(cardTimerRef.current)
    cardTimerRef.current = setTimeout(() => {
      setCurrentIndex(0) // 始终取第一个
      setIsFlipped(false)
    }, 300)

  }, [queue, currentIndex, removeFromQueue, moveToEnd, reinsertAfter])

  // --- 完成检测 ---
  useEffect(() => {
    if (queue.length === 0 && completedCount >= 0 && !isComplete) {
      // 所有单词处理完毕
      setIsComplete(true)

      // 记录学习 session
      sessionSavedRef.current = true // 标记已保存，避免 unmount 重复
      const duration = Math.floor((Date.now() - studyStartTime) / 1000)
      createStudySession({
        duration_seconds: duration,
        word_count: completedCount
      }).catch(err => console.error('记录学习 session 失败:', err))

      setElapsedSeconds(duration)
    }
  }, [queue.length, completedCount, isComplete, studyStartTime])

  // --- 打卡 ---
  const handleCheckIn = async () => {
    setCheckingIn(true)
    try {
      await checkIn()
      setCheckedIn(true)
    } catch (err) {
      alert(err.response?.data?.error || '打卡失败')
    }
    setCheckingIn(false)
  }

  // --- 格式化时间 ---
  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // --- 获取当前单词 ---
  const currentWord = queue.length > 0 ? queue[currentIndex] : null

  // --- 完成页面 ---
  if (isComplete) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="bg-white rounded-2xl shadow-xl p-12 text-center max-w-md w-full">
          <div className="text-6xl mb-6">🎉</div>
          <h1 className="text-3xl font-bold text-gray-800 mb-4">
            恭喜完成今日学习任务
          </h1>
          <div className="space-y-3 mb-8 text-gray-600">
            <div className="flex justify-between px-8">
              <span>📖 学习单词</span>
              <span className="font-semibold">{completedCount} 个</span>
            </div>
            <div className="flex justify-between px-8">
              <span>⏱ 学习时长</span>
              <span className="font-semibold">{formatTime(elapsedSeconds)}</span>
            </div>
          </div>

          {!checkedIn ? (
            <button
              onClick={handleCheckIn}
              disabled={checkingIn}
              className="w-full bg-blue-600 text-white py-3 rounded-xl text-lg font-semibold
                         hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {checkingIn ? '打卡中...' : '✅ 完成打卡'}
            </button>
          ) : (
            <div className="text-green-600 font-semibold text-lg">
              ✅ 今日已打卡
            </div>
          )}

          <button
            onClick={() => window.location.reload()}
            className="mt-4 text-blue-500 hover:text-blue-700 text-sm"
          >
            重新开始学习
          </button>
        </div>
      </div>
    )
  }

  // --- 加载中 ---
  if (!currentWord && queue.length === 0 && !isComplete) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400 text-lg">加载中...</div>
      </div>
    )
  }

  // --- 主界面 ---
  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* ===== 顶部统计栏 ===== */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex justify-between items-center">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{newRemaining}</div>
            <div className="text-xs text-gray-500">今日新词剩余</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{reviewRemaining}</div>
            <div className="text-xs text-gray-500">待复习</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{completedCount}</div>
            <div className="text-xs text-gray-500">已完成</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-600">{formatTime(elapsedSeconds)}</div>
            <div className="text-xs text-gray-500">学习时长</div>
          </div>
        </div>
        {/* 进度条 */}
        <div className="mt-3 bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className="bg-blue-500 h-full rounded-full transition-all duration-500"
            style={{
              width: `${(completedCount / Math.max(1, completedCount + newRemaining + reviewRemaining)) * 100}%`
            }}
          />
        </div>
      </div>

      {/* ===== 单词卡片 ===== */}
      <div
        className="card-container cursor-pointer select-none"
        onClick={() => setIsFlipped(!isFlipped)}
      >
        <div className={`card-inner ${isFlipped ? 'flipped' : ''}`}>
          {/* 正面：单词 + 音标 */}
          <div className="card-front bg-white rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center min-h-[300px]">
            <p className="text-sm text-gray-400 mb-4">
              {currentWord.status === 'learning' ? '🔄 待复习' : '🆕 新词'} · 点击翻转
            </p>
            <h2 className="text-5xl font-bold text-gray-800 mb-3 tracking-wide">
              {currentWord.word}
            </h2>
            {currentWord.phonetic && (
              <p className="text-xl text-gray-500 mb-2">{currentWord.phonetic}</p>
            )}
            {/* 发音按钮 */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                playPronunciation(currentWord.word);
              }}
              className="mt-2 px-4 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full text-sm font-medium transition-colors flex items-center gap-1"
              title="播放发音"
            >
              🔊 发音
            </button>
            <p className="text-xs text-gray-300 mt-6">👆 点击卡片查看释义</p>
          </div>

          {/* 背面：释义 + 例句 */}
          <div className="card-back bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center min-h-[300px]">
            <div className="flex items-center gap-3 mb-4">
              <p className="text-2xl font-bold text-gray-800">{currentWord.word}</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  playPronunciation(currentWord.word);
                }}
                className="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full text-sm transition-colors"
                title="播放发音"
              >
                🔊
              </button>
            </div>
            <p className="text-2xl text-gray-800 font-semibold mb-6 text-center leading-relaxed">
              {currentWord.meaning}
            </p>
            {currentWord.example && (
              <div className="bg-white/60 rounded-xl p-4 w-full">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-gray-500 text-sm">例句</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playSentence(currentWord.example);
                    }}
                    className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-full text-xs transition-colors"
                    title="播放例句"
                  >
                    🔊 播放
                  </button>
                </div>
                <p className="text-gray-700 italic">"{currentWord.example}"</p>
                {currentWord.example_translation && (
                  <p className="text-gray-600 text-sm mt-2">👉 {currentWord.example_translation}</p>
                )}
              </div>
            )}
            {currentWord.review_count > 0 && (
              <p className="text-xs text-gray-400 mt-4">
                已复习 {currentWord.review_count} 次
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 队列进度指示器 */}
      <div className="text-center text-sm text-gray-400">
        队列剩余 {queue.length} 个单词
      </div>

      {/* ===== 底部按钮 ===== */}
      <div className="grid grid-cols-3 gap-4">
        <button
          onClick={() => handleAnswer('unknown')}
          className="py-4 rounded-xl text-white font-semibold text-lg
                     bg-red-500 hover:bg-red-600 active:scale-95 transition-all shadow-md"
        >
          😕 不认识
        </button>
        <button
          onClick={() => handleAnswer('fuzzy')}
          className="py-4 rounded-xl text-white font-semibold text-lg
                     bg-yellow-500 hover:bg-yellow-600 active:scale-95 transition-all shadow-md"
        >
          🤔 模糊
        </button>
        <button
          onClick={() => handleAnswer('know')}
          className="py-4 rounded-xl text-white font-semibold text-lg
                     bg-green-500 hover:bg-green-600 active:scale-95 transition-all shadow-md"
        >
          😊 认识
        </button>
      </div>
    </div>
  )
}

export default StudyWords
