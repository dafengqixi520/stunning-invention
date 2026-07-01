import { useState, useEffect } from 'react'
import { getBooks } from '../services/api'

const SELECTED_BOOK_KEY = 'selected_book'

function Books() {
  const [books, setBooks] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState(() => {
    const saved = localStorage.getItem(SELECTED_BOOK_KEY)
    return saved ? parseInt(saved, 10) : null
  })
  const [toast, setToast] = useState(null)

  useEffect(() => {
    loadBooks()
  }, [])

  const loadBooks = async () => {
    try {
      const data = await getBooks()
      setBooks(data)
    } catch (error) {
      console.error('加载单词本失败:', error)
    }
    setLoading(false)
  }

  const handleSelect = (book) => {
    if (selectedId === book.id) {
      // 取消选中
      setSelectedId(null)
      localStorage.removeItem(SELECTED_BOOK_KEY)
    } else {
      setSelectedId(book.id)
      localStorage.setItem(SELECTED_BOOK_KEY, book.id)
      showToast(`✅ 已选择「${book.name}」，将重新开始学习`)
    }
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // 根据掌握率返回颜色
  const getRateColor = (rate) => {
    if (rate >= 80) return 'bg-green-500'
    if (rate >= 40) return 'bg-yellow-500'
    return 'bg-blue-500'
  }

  // 获取当前选中书籍的名称
  const selectedBook = books.find(b => b.id === selectedId)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400 text-lg">加载中...</div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 标题区 */}
      <div>
        <h1 className="text-3xl font-bold text-gray-800">选择单词书</h1>
        <p className="text-gray-500 mt-1">
          {selectedBook
            ? `当前选中：${selectedBook.name}`
            : '请选择一本单词书开始学习'}
        </p>
      </div>

      {/* Toast 提示 */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50
                        bg-gray-800 text-white px-6 py-3 rounded-xl shadow-lg
                        animate-bounce text-sm">
          {toast}
        </div>
      )}

      {/* 单词书列表 */}
      <div className="space-y-4">
        {books.map((book) => {
          const isSelected = selectedId === book.id
          const mastered = book.mastered_count || 0
          const learning = book.learning_count || 0
          const newCount = book.new_count || 0
          const total = book.total_words || 1
          const rate = book.mastery_rate || 0

          return (
            <div
              key={book.id}
              onClick={() => handleSelect(book)}
              className={`relative bg-white rounded-2xl shadow-md p-6 cursor-pointer
                          transition-all duration-300 hover:shadow-xl
                          ${isSelected
                            ? 'ring-3 ring-blue-500 shadow-lg scale-[1.02]'
                            : 'hover:scale-[1.01]'}`}
            >
              {/* 选中标记 */}
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                    ✅ 当前使用
                  </span>
                </div>
              )}

              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className={`text-xl font-bold ${isSelected ? 'text-blue-600' : 'text-gray-800'}`}>
                    {book.name}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    共 {total} 个单词
                  </p>
                </div>
              </div>

              {/* 统计数 */}
              <div className="flex gap-4 mb-4 text-sm">
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block"></span>
                  <span className="text-gray-600">已掌握</span>
                  <span className="font-semibold text-green-600">{mastered}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block"></span>
                  <span className="text-gray-600">学习中</span>
                  <span className="font-semibold text-yellow-600">{learning}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-300 inline-block"></span>
                  <span className="text-gray-600">未学</span>
                  <span className="font-semibold text-gray-500">{newCount}</span>
                </div>
              </div>

              {/* 进度条 */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>掌握率</span>
                  <span className="font-semibold">{rate}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${getRateColor(rate)}`}
                    style={{ width: `${rate}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 空状态 */}
      {books.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-5xl mb-4">📚</div>
          <p className="text-lg">暂无单词书</p>
        </div>
      )}
    </div>
  )
}

export default Books
