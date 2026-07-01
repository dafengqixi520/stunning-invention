import { useState, useEffect } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'
import { getWeekStats } from '../services/api'

function StudyStats() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    try {
      const data = await getWeekStats()
      setStats(data)
    } catch (err) {
      console.error('加载统计数据失败:', err)
    }
    setLoading(false)
  }

  const formatMinutes = (seconds) => {
    if (!seconds || seconds === 0) return '0 分钟'
    const m = Math.floor(seconds / 60)
    if (m < 1) return '<1 分钟'
    const h = Math.floor(m / 60)
    if (h > 0) return `${h} 小时 ${m % 60} 分钟`
    return `${m} 分钟`
  }

  // 图表数据：格式化日期为简短标签
  const chartData = stats?.daily?.map(d => ({
    ...d,
    label: d.date.slice(5), // MM-DD
    minutes: Math.round(d.duration_seconds / 60)
  })) || []

  // 今日日期标签
  const todayLabel = stats?.today?.date
    ? `${stats.today.date.slice(5)} (今天)`
    : ''

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-md p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-24 mb-4"></div>
        <div className="h-40 bg-gray-100 rounded"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ===== 今日 + 本周统计卡片 ===== */}
      <div className="grid grid-cols-2 gap-4">
        {/* 今日 */}
        <div className="bg-white rounded-2xl shadow-md p-5">
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            📅 今日 ({todayLabel})
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-sm">学习时长</span>
              <span className="text-xl font-bold text-blue-600">
                {formatMinutes(stats?.today?.duration_seconds || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-sm">学习单词</span>
              <span className="text-xl font-bold text-green-600">
                {stats?.today?.word_count || 0} 个
              </span>
            </div>
          </div>
        </div>

        {/* 本周 */}
        <div className="bg-white rounded-2xl shadow-md p-5">
          <h3 className="text-sm font-medium text-gray-500 mb-3">
            📊 本周累计
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-sm">学习时长</span>
              <span className="text-xl font-bold text-blue-600">
                {formatMinutes(stats?.week?.duration_seconds || 0)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 text-sm">学习单词</span>
              <span className="text-xl font-bold text-green-600">
                {stats?.week?.word_count || 0} 个
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ===== 最近7天柱状图 ===== */}
      <div className="bg-white rounded-2xl shadow-md p-5">
        <h3 className="text-sm font-medium text-gray-500 mb-4">
          📈 最近 7 天学习时长（分钟）
        </h3>

        {chartData.every(d => d.duration_seconds === 0) ? (
          <div className="text-center py-8 text-gray-400">
            <div className="text-4xl mb-2">📭</div>
            <p className="text-sm">暂无学习记录</p>
            <p className="text-xs mt-1">去背单词页面开始学习吧</p>
          </div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={{ stroke: '#e5e7eb' }}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    fontSize: '13px'
                  }}
                  formatter={(value) => [`${value} 分钟`, '学习时长']}
                  labelFormatter={(label) => {
                    const item = chartData.find(d => d.label === label)
                    const wordCount = item ? item.word_count : 0
                    return `${label} · ${wordCount} 词`
                  }}
                />
                <Bar dataKey="minutes" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {chartData.map((entry, index) => {
                    const isToday = entry.date === stats?.today?.date
                    return (
                      <Cell
                        key={index}
                        fill={isToday ? '#3b82f6' : '#93c5fd'}
                        stroke={isToday ? '#2563eb' : 'none'}
                        strokeWidth={isToday ? 1.5 : 0}
                      />
                    )
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

export default StudyStats
