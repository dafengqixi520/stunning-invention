import { Link } from 'react-router-dom'

function Home() {
  return (
    <div className="space-y-8">
      {/* 欢迎区域 */}
      <div className="bg-white rounded-lg shadow-md p-8">
        <h1 className="text-4xl font-bold text-gray-800 mb-4">
          欢迎使用拾词杂货铺
        </h1>
        <p className="text-gray-600 text-lg mb-6">
          一个简单高效的英语单词学习工具，帮助你轻松记忆单词。
        </p>
        <div className="flex space-x-4">
          <Link
            to="/study"
            className="bg-green-600 text-white px-8 py-4 rounded-lg hover:bg-green-700 transition-colors text-lg font-semibold"
          >
            🎯 开始背单词
          </Link>
          <Link
            to="/books"
            className="bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors"
          >
            查看单词本
          </Link>
        </div>
      </div>

      {/* 功能介绍 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-blue-600 text-3xl mb-4">📚</div>
          <h3 className="text-xl font-semibold mb-2">单词管理</h3>
          <p className="text-gray-600">
            添加、编辑、删除单词，支持音标、释义、例句等多种信息。
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-green-600 text-3xl mb-4">📖</div>
          <h3 className="text-xl font-semibold mb-2">单词本</h3>
          <p className="text-gray-600">
            创建不同的单词本，分类管理你的单词，便于针对性学习。
          </p>
        </div>
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="text-purple-600 text-3xl mb-4">🎯</div>
          <h3 className="text-xl font-semibold mb-2">学习记录</h3>
          <p className="text-gray-600">
            记录学习进度，追踪复习情况，帮助你更高效地记忆单词。
          </p>
        </div>
      </div>
    </div>
  )
}

export default Home
