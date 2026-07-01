import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import Words from './pages/Words'
import Books from './pages/Books'
import StudyWords from './pages/StudyWords'
import CheckIn from './pages/CheckIn'
import SearchPage from './pages/SearchPage'
import WordDetailPage from './pages/WordDetailPage'

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        {/* 导航栏 */}
        <nav className="bg-white shadow-lg sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Link to="/" className="text-2xl font-bold text-blue-600">
                  📖 拾词杂货铺
                </Link>
              </div>
              <div className="flex space-x-1 items-center">
                <Link
                  to="/search"
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md font-medium"
                >
                  🔍 搜索
                </Link>
                <Link
                  to="/study"
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md font-medium"
                >
                  🎯 背单词
                </Link>
                <Link
                  to="/books"
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md font-medium"
                >
                  📚 单词书
                </Link>
                <Link
                  to="/words"
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md font-medium"
                >
                  📝 单词列表
                </Link>
                <Link
                  to="/checkin"
                  className="text-gray-700 hover:text-blue-600 px-3 py-2 rounded-md font-medium"
                >
                  📅 打卡
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* 主要内容 */}
        <main className="max-w-7xl mx-auto py-6 px-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/words/:id" element={<WordDetailPage />} />
            <Route path="/study" element={<StudyWords />} />
            <Route path="/books" element={<Books />} />
            <Route path="/words" element={<Words />} />
            <Route path="/checkin" element={<CheckIn />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

export default App
