import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

const API_BASE_URL = '/api';

async function apiGet(url, params) {
  const query = new URLSearchParams(params).toString();
  const fullUrl = `${API_BASE_URL}${url}${query ? '?' + query : ''}`;
  const res = await fetch(fullUrl);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function SearchPage() {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState('english');
  const [error, setError] = useState('');
  const timeoutRef = useRef(null);

  // 防抖搜索
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    const trimmed = keyword.trim();
    if (!trimmed) {
      setResults([]);
      setTotal(0);
      setError('');
      return;
    }

    setLoading(true);
    setError('');

    timeoutRef.current = setTimeout(async () => {
      try {
        console.log('搜索请求:', trimmed, searchType);
        const data = await apiGet('/words/search', { q: trimmed, type: searchType, page: 1, pageSize: 20 });
        console.log('搜索响应:', data);
        
        if (data && Array.isArray(data.results)) {
          setResults(data.results);
          setTotal(data.total || 0);
        } else {
          setError('响应格式异常: ' + JSON.stringify(data).slice(0, 100));
          setResults([]);
          setTotal(0);
        }
      } catch (err) {
        console.error('搜索错误:', err);
        setError('请求失败: ' + err.message);
        setResults([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [keyword, searchType]);

  const doSearch = () => {
    // 手动触发：清除现有定时器并立即执行
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    const trimmed = keyword.trim();
    if (!trimmed) return;

    setLoading(true);
    setError('');
    
    apiGet('/words/search', { q: trimmed, type: searchType, page: 1, pageSize: 20 })
      .then(data => {
        console.log('手动搜索响应:', data);
        if (data && Array.isArray(data.results)) {
          setResults(data.results);
          setTotal(data.total || 0);
        } else {
          setError('响应格式异常');
          setResults([]);
        }
      })
      .catch(err => {
        console.error('手动搜索错误:', err);
        setError('请求失败: ' + err.message);
        setResults([]);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* 错误信息 */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <strong>错误:</strong> {error}
        </div>
      )}

      {/* 搜索框 */}
      <div className="bg-gray-50 py-4 mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && doSearch()}
            placeholder={searchType === 'english' ? '输入英文单词...' : '输入中文释义...'}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
          />
          <button
            onClick={doSearch}
            disabled={loading}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? '...' : '搜索'}
          </button>
        </div>

        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setSearchType('english')}
            className={`px-4 py-2 rounded-lg text-sm ${searchType === 'english' ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-gray-100 text-gray-600'}`}
          >
            英文
          </button>
          <button
            onClick={() => setSearchType('chinese')}
            className={`px-4 py-2 rounded-lg text-sm ${searchType === 'chinese' ? 'bg-blue-100 text-blue-700 font-medium' : 'bg-gray-100 text-gray-600'}`}
          >
            中文
          </button>
        </div>
      </div>

      {/* 状态信息 */}
      <div className="text-sm text-gray-500 mb-4">
        关键词: "{keyword}" | 类型: {searchType} | 加载中: {loading ? '是' : '否'} | 结果数: {results.length} | 总数: {total}
      </div>

      {/* 搜索结果 */}
      {results.length > 0 ? (
        <div className="space-y-2">
          {results.map((word) => (
            <Link
              key={word.id}
              to={`/words/${word.id}`}
              className="block bg-white rounded-lg shadow p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between">
                <div>
                  <span className="text-lg font-semibold">{word.word}</span>
                  {word.phonetic && <span className="text-gray-400 text-sm ml-2">{word.phonetic}</span>}
                  <p className="text-gray-600 text-sm mt-1">{word.meaning?.substring(0, 60)}{word.meaning?.length > 60 ? '...' : ''}</p>
                </div>
                {word.collins > 0 && (
                  <span className="text-yellow-500 text-sm">{'★'.repeat(word.collins)}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      ) : keyword && !loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">未找到相关单词</p>
        </div>
      ) : null}
    </div>
  );
}

export default SearchPage;
