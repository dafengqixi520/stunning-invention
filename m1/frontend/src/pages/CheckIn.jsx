import { useState, useEffect, useCallback } from 'react'
import { getMonthCheckIns, getTodayCheckIn, checkIn } from '../services/api'
import StudyStats from '../components/StudyStats'

// 星期标题
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

function CheckIn() {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  const [currentYear, setCurrentYear] = useState(today.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(today.getMonth() + 1) // 1-12
  const [checkInDates, setCheckInDates] = useState(new Set())
  const [compensatedDates, setCompensatedDates] = useState(new Set())
  const [streak, setStreak] = useState(0)
  const [monthlyCount, setMonthlyCount] = useState(0)
  const [todayCheckedIn, setTodayCheckedIn] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [toast, setToast] = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // 加载数据
  const loadData = useCallback(async () => {
    try {
      const [monthData, todayData] = await Promise.all([
        getMonthCheckIns(currentYear, currentMonth),
        getTodayCheckIn()
      ])

      setCheckInDates(new Set(monthData.check_ins.map(c => c.date)))
      setCompensatedDates(new Set(
        monthData.check_ins.filter(c => c.is_compensated).map(c => c.date)
      ))
      setStreak(monthData.streak || 0)
      setMonthlyCount(monthData.monthly_count || 0)
      setTodayCheckedIn(todayData.checked_in || false)
    } catch (error) {
      console.error('加载打卡数据失败:', error)
    }
  }, [currentYear, currentMonth])

  useEffect(() => {
    loadData()
  }, [loadData])

  // 月份导航
  const prevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear(y => y - 1)
      setCurrentMonth(12)
    } else {
      setCurrentMonth(m => m - 1)
    }
  }

  const nextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear(y => y + 1)
      setCurrentMonth(1)
    } else {
      setCurrentMonth(m => m + 1)
    }
  }

  // 执行打卡
  const handleCheckIn = async () => {
    setCheckingIn(true)
    try {
      await checkIn()
      setTodayCheckedIn(true)
      showToast('✅ 打卡成功！')
      loadData() // 刷新数据
    } catch (err) {
      showToast(err.response?.data?.error || '打卡失败')
    }
    setCheckingIn(false)
  }

  // ===== 构建日历数据 =====
  const buildCalendar = () => {
    const year = currentYear
    const month = currentMonth

    // 当月第一天是星期几（0=Sunday, 1=Monday, ...）
    const firstDay = new Date(year, month - 1, 1)
    let dayOfWeek = firstDay.getDay() // 0=Sun
    // 转为周一=0
    dayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1

    // 当月天数
    const daysInMonth = new Date(year, month, 0).getDate()

    const weeks = []
    let week = []

    // 填充前置空白
    for (let i = 0; i < dayOfWeek; i++) {
      week.push(null)
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const isChecked = checkInDates.has(dateStr)
      const isCompensated = compensatedDates.has(dateStr)
      const isToday = dateStr === todayStr
      const isFuture = new Date(dateStr) > new Date(todayStr)

      week.push({ day: d, dateStr, isChecked, isCompensated, isToday, isFuture })

      if (week.length === 7) {
        weeks.push(week)
        week = []
      }
    }

    // 填充末尾空白
    if (week.length > 0) {
      while (week.length < 7) {
        week.push(null)
      }
      weeks.push(week)
    }

    return weeks
  }

  const weeks = buildCalendar()

  return (
    <div className="max-w-md mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50
                        bg-gray-800 text-white px-6 py-3 rounded-xl shadow-lg
                        animate-bounce text-sm">
          {toast}
        </div>
      )}

      {/* 标题 */}
      <h1 className="text-3xl font-bold text-gray-800">打卡日历</h1>

      {/* 连续打卡 + 本月统计 */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-md p-4 text-center">
          <div className="text-3xl font-bold text-orange-500">🔥</div>
          <div className="text-2xl font-bold text-gray-800">{streak}</div>
          <div className="text-xs text-gray-500">连续打卡天数</div>
        </div>
        <div className="bg-white rounded-xl shadow-md p-4 text-center">
          <div className="text-3xl font-bold text-green-500">📅</div>
          <div className="text-2xl font-bold text-gray-800">{monthlyCount}</div>
          <div className="text-xs text-gray-500">本月累计打卡</div>
        </div>
      </div>

      {/* 月份导航 */}
      <div className="bg-white rounded-xl shadow-md p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={prevMonth}
            className="w-10 h-10 flex items-center justify-center rounded-full
                       hover:bg-gray-100 text-gray-600 text-xl transition-colors"
          >
            ‹
          </button>
          <h2 className="text-lg font-bold text-gray-800">
            {currentYear} 年 {currentMonth} 月
          </h2>
          <button
            onClick={nextMonth}
            className="w-10 h-10 flex items-center justify-center rounded-full
                       hover:bg-gray-100 text-gray-600 text-xl transition-colors"
          >
            ›
          </button>
        </div>

        {/* 星期标题 */}
        <div className="grid grid-cols-7 mb-2">
          {WEEKDAYS.map((d, i) => (
            <div
              key={i}
              className={`text-center text-xs font-medium py-2
                          ${i >= 5 ? 'text-red-400' : 'text-gray-400'}`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* 日期网格 */}
        <div className="space-y-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((cell, ci) => {
                if (!cell) {
                  return <div key={`e-${ci}`} className="aspect-square" />
                }

                const { day, isChecked, isCompensated, isToday } = cell

                return (
                  <div
                    key={day}
                    className={`aspect-square flex flex-col items-center justify-center
                                rounded-lg text-sm transition-all relative
                                ${isChecked
                                  ? 'bg-green-500 text-white font-semibold shadow-md'
                                  : 'hover:bg-gray-100 text-gray-700'}
                                ${isToday && !isChecked
                                  ? 'ring-2 ring-blue-400 font-semibold'
                                  : ''}
                                ${isCompensated
                                  ? 'bg-orange-400 text-white'
                                  : ''}`}
                  >
                    <span>{day}</span>
                    {isChecked && !isCompensated && (
                      <span className="text-[10px]">✅</span>
                    )}
                    {isCompensated && (
                      <span className="text-[10px]">🕐</span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* 打卡按钮 */}
      <div className="bg-white rounded-xl shadow-md p-6 text-center">
        {todayCheckedIn ? (
          <div>
            <div className="text-4xl mb-2">✅</div>
            <p className="text-green-600 font-semibold text-lg">今日已打卡</p>
            <p className="text-gray-400 text-sm mt-1">继续保持！</p>
          </div>
        ) : (
          <div>
            <p className="text-gray-600 mb-4 text-sm">
              今日学习时长 ≥ 60秒 或 学习单词 ≥ 5 即可打卡
            </p>
            <button
              onClick={handleCheckIn}
              disabled={checkingIn}
              className="w-full bg-green-500 text-white py-3 rounded-xl text-lg font-semibold
                         hover:bg-green-600 transition-colors disabled:opacity-50
                         active:scale-95"
            >
              {checkingIn ? '打卡中...' : '✅ 立即打卡'}
            </button>
          </div>
        )}
      </div>

      {/* 图例 */}
      <div className="flex justify-center gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-500 inline-block"></span>
          已打卡
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-orange-400 inline-block"></span>
          补签
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 rounded ring-2 ring-blue-400 inline-block"></span>
          今天
        </div>
      </div>

      {/* ===== 学习统计（今日/本周 + 7天图表） ===== */}
      <StudyStats />
    </div>
  )
}

export default CheckIn
