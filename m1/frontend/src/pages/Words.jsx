import { useState, useEffect } from 'react'
import { getBooks, getBookWords, reviewWord } from '../services/api'

function Words() {
  const [books, setBooks] = useState([])
  const [selectedBook, setSelectedBook] = useState(null)
  const [words, setWords] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadBooks()
  }, [])

  useEffect(() => {
    if (selectedBook) {
      loadWords()
    }
  }, [selectedBook, statusFilter])

  const loadBooks = async () => {
    try {
      const data = await getBooks()
      setBooks(data)
      if (data.length > 0 && !selectedBook) {
        setSelectedBook(data[0].id)
      }
    } catch (error) {
      console.error('加载单词本失败:', error)
    }
  }

  const loadWords = async () => {
    setLoading(true)
    try {
      const params = { limit: 50 }
      if (statusFilter) params.status = statusFilter
      const data = await getBookWords(selectedBook, params)
      setWords(data)
    } catch (error) {
      console.error('加载单词失败:', error)
    }
    setLoading(false)
  }

  const handleReview = async (wordId, status) => {
    try {
      await reviewWord(wordId, status)
      loadWords()
    } catch (error) {
      alert(error.response?.data?.error || '操作失败')
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      new: 'bg-gray-100 text-gray-700',
      learning: 'bg-yellow-100 text-yellow-800',
      mastered: 'bg-green-100 text-green-800'
    }
    const labels = {
      new: '新词',
      learning: '学习中',
      mastered: '已掌握'
    }
    return (
      <span className={`px-2 py-1 rounded text-sm ${badges[status] || badges.new}`}>
        {labels[status] || status || '新词'}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-800">单词列表</h1>
      </div>

      {/* 单词书选择和状态筛选 */}
      <div className="bg-white rounded-lg shadow-md p-4 flex flex-wrap gap-4 items-center">
        <div>
          <label className="text-sm font-medium text-gray-700 mr-2">单词书:</label>
          <select
            value={selectedBook || ''}
            onChange={(e) => setSelectedBook(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            {books.map((b) => (
              <option key={b.id} value={b.id}>{b.name} ({b.total_words}词)</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 mr-2">状态:</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md"
          >
            <option value="">全部</option>
            <option value="new">新词</option>
            <option value="learning">学习中</option>
            <option value="mastered">已掌握</option>
          </select>
        </div>
        <span className="text-sm text-gray-500">
          共 {words.length} 个单词
        </span>
      </div>

      {/* 单词列表 */}
      {loading ? (
        <div className="text-center py-8">加载中...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {words.map((w) => (
            <div key={w.id} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">{w.word}</h3>
                  {w.phonetic && (
                    <p className="text-gray-500 text-sm">{w.phonetic}</p>
                  )}
                </div>
                {getStatusBadge(w.status)}
              </div>
              <p className="text-gray-700 mb-2">{w.meaning}</p>
              {w.example && (
                <p className="text-gray-500 text-sm italic mb-3">"{w.example}"</p>
              )}
              {/* 复习按钮 */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                {w.status !== 'learning' && (
                  <button
                    onClick={() => handleReview(w.id, 'learning')}
                    className="px-3 py-1 bg-yellow-500 text-white rounded text-sm hover:bg-yellow-600"
                  >
                    学习中
                  </button>
                )}
                {w.status !== 'mastered' && (
                  <button
                    onClick={() => handleReview(w.id, 'mastered')}
                    className="px-3 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600"
                  >
                    已掌握
                  </button>
                )}
                <button
                  onClick={() => handleReview(w.id, 'new')}
                  className="px-3 py-1 bg-gray-300 text-gray-700 rounded text-sm hover:bg-gray-400"
                >
                  重置
                </button>
              </div>
              {w.review_count > 0 && (
                <p className="text-xs text-gray-400 mt-2">
                  复习 {w.review_count} 次 · 下次: {w.next_review_date || '-'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && words.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          {selectedBook ? '该单词书暂无单词' : '请先选择一个单词书'}
        </div>
      )}
    </div>
  )
}

export default Words
