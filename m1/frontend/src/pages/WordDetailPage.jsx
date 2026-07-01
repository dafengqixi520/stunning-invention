import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { playPronunciation, playSentence } from '../utils/audioPlayer';

const API_BASE_URL = '/api';

async function apiGet(url) {
  const res = await fetch(`${API_BASE_URL}${url}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function apiPost(url, body) {
  const res = await fetch(`${API_BASE_URL}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function WordDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [word, setWord] = useState(null);
  const [userStatus, setUserStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadWord();
  }, [id]);

  const loadWord = async () => {
    setLoading(true);
    try {
      const wordData = await apiGet(`/words/${id}`);
      setWord(wordData);
      
      try {
        const userWordsData = await apiGet('/user-words?status=new');
        const userWord = userWordsData.find(w => w.id === wordData.id);
        setUserStatus(userWord?.status || 'new');
      } catch (userError) {
        setUserStatus('new');
      }
    } catch (error) {
      console.error('加载单词失败:', error);
      if (error.message.includes('404')) {
        alert('单词未找到');
        navigate('/search');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMarkStatus = async (status) => {
    setActionLoading(true);
    try {
      await apiPost(`/user-words/${id}/review`, { status });
      setUserStatus(status);
    } catch (error) {
      alert('操作失败');
    } finally {
      setActionLoading(false);
    }
  };

  const getStars = (count) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <span key={i} className={i <= Math.min(count, 5) ? 'text-yellow-400' : 'text-gray-300'}>
          ★
        </span>
      );
    }
    return stars;
  };

  const getStatusBadge = (status) => {
    const badges = {
      new: { class: 'bg-gray-100 text-gray-700', label: '新词' },
      learning: { class: 'bg-yellow-100 text-yellow-800', label: '学习中' },
      mastered: { class: 'bg-green-100 text-green-800', label: '已掌握' }
    };
    const config = badges[status] || badges.new;
    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${config.class}`}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-xl text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!word) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-4">🔍</div>
        <p className="text-gray-500">单词未找到</p>
        <Link to="/search" className="text-blue-600 hover:underline mt-4 inline-block">
          返回搜索页面
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* 返回按钮 */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1 text-gray-600 hover:text-gray-800 mb-6"
      >
        ← 返回
      </button>

      {/* 单词卡片 */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* 单词头部 */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-8">
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-4xl font-bold">{word.word}</h1>
                <button
                  onClick={() => playPronunciation(word.word)}
                  className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-full text-sm transition-colors"
                  title="播放发音"
                >
                  🔊 发音
                </button>
              </div>
              {word.phonetic && (
                <p className="text-blue-100 text-lg">{word.phonetic}</p>
              )}
            </div>
            {userStatus && getStatusBadge(userStatus)}
          </div>
          
          {/* 词频星级 */}
          {word.collins > 0 && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-blue-200">柯林斯星级：</span>
              <div className="flex text-xl">{getStars(word.collins)}</div>
            </div>
          )}
        </div>

        {/* 详细信息 */}
        <div className="p-6 space-y-6">
          {/* 词性 */}
          {word.pos && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 w-16">词性：</span>
              <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                {word.pos}
              </span>
            </div>
          )}

          {/* 中文释义 */}
          <div>
            <span className="text-sm text-gray-500 block mb-2">中文释义：</span>
            <div className="text-gray-800 text-lg leading-relaxed whitespace-pre-wrap">
              {word.meaning}
            </div>
          </div>

          {/* 英文释义（如果有） */}
          {word.english && (
            <div>
              <span className="text-sm text-gray-500 block mb-2">英文释义：</span>
              <div className="text-gray-600 italic whitespace-pre-wrap">
                {word.english}
              </div>
            </div>
          )}

          {/* 例句 */}
          {word.example && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-500">例句：</span>
                <button
                  onClick={() => playSentence(word.example)}
                  className="px-2 py-1 bg-green-100 hover:bg-green-200 text-green-700 rounded-full text-xs transition-colors"
                  title="播放例句"
                >
                  🔊 播放
                </button>
              </div>
              <p className="text-gray-800 italic">"{word.example}"</p>
              {word.example_translation && (
                <p className="text-gray-600 mt-2">👉 {word.example_translation}</p>
              )}
            </div>
          )}

          {/* 标签 */}
          {word.tag && (
            <div>
              <span className="text-sm text-gray-500 block mb-2">标签：</span>
              <div className="flex flex-wrap gap-2">
                {word.tag.split(',').map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-sm"
                  >
                    {tag.trim()}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 难度和频率 */}
          <div className="flex gap-6">
            <div>
              <span className="text-sm text-gray-500">难度：</span>
              <span className="font-medium">
                {'⭐'.repeat(word.difficulty || 1)}{'☆'.repeat(5 - (word.difficulty || 1))}
              </span>
            </div>
            {word.bnc && (
              <div>
                <span className="text-sm text-gray-500">BNC 词频：</span>
                <span className="font-medium">{word.bnc}</span>
              </div>
            )}
            {word.frequency && word.frequency > 0 && (
              <div>
                <span className="text-sm text-gray-500">频率：</span>
                <span className="font-medium">{word.frequency.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="px-6 pb-6">
          <div className="flex gap-3">
            {userStatus !== 'learning' && (
              <button
                onClick={() => handleMarkStatus('learning')}
                disabled={actionLoading}
                className="flex-1 py-3 bg-yellow-500 text-white rounded-lg font-medium hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {actionLoading ? '处理中...' : '加入复习队列'}
              </button>
            )}
            {userStatus !== 'mastered' && (
              <button
                onClick={() => handleMarkStatus('mastered')}
                disabled={actionLoading}
                className="flex-1 py-3 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {actionLoading ? '处理中...' : '已掌握'}
              </button>
            )}
            {userStatus !== 'new' && (
              <button
                onClick={() => handleMarkStatus('new')}
                disabled={actionLoading}
                className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                重置
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 搜索推荐 */}
      <div className="mt-6 text-center">
        <p className="text-sm text-gray-500 mb-3">想搜索其他单词？</p>
        <Link
          to="/search"
          className="inline-flex items-center gap-2 px-6 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors"
        >
          🔍 返回搜索
        </Link>
      </div>
    </div>
  );
}

export default WordDetailPage;
