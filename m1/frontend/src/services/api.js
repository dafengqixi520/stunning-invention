import axios from 'axios'

const API_BASE_URL = '/api'

// ===== 单词书 API =====
// 1. 获取所有单词书
export const getBooks = () => axios.get(`${API_BASE_URL}/word-books`).then(res => res.data)

// 2. 根据单词书ID获取单词（支持 status 筛选和 limit 分页）
export const getBookWords = (bookId, { status, limit } = {}) => {
  const params = {}
  if (status) params.status = status
  if (limit) params.limit = limit
  return axios.get(`${API_BASE_URL}/word-books/${bookId}/words`, { params }).then(res => res.data)
}

// ===== 用户单词 API =====
// 获取用户单词列表（支持 status 筛选）
export const getUserWords = ({ status, limit, due } = {}) => {
  const params = {}
  if (status) params.status = status
  if (limit) params.limit = limit
  if (due) params.due = due
  return axios.get(`${API_BASE_URL}/user-words`, { params }).then(res => res.data)
}

// 3. 复习单词（更新用户单词状态）
// next_review_date 可选，用于自定义下次复习日期
export const reviewWord = (wordId, status, nextReviewDate) => {
  const body = { status }
  if (nextReviewDate) body.next_review_date = nextReviewDate
  return axios.post(`${API_BASE_URL}/user-words/${wordId}/review`, body).then(res => res.data)
}

// ===== 学习记录 API =====
// 4. 记录学习时长
export const createStudySession = (data) =>
  axios.post(`${API_BASE_URL}/study-sessions`, data).then(res => res.data)

// 获取最近7天学习统计
export const getWeekStats = () =>
  axios.get(`${API_BASE_URL}/study-sessions/week`).then(res => res.data)

// ===== 打卡 API =====
// 5. 查询今日是否已打卡
export const getTodayCheckIn = () =>
  axios.get(`${API_BASE_URL}/check-in/today`).then(res => res.data)

// 6. 执行打卡
export const checkIn = () =>
  axios.post(`${API_BASE_URL}/check-in`).then(res => res.data)

// 获取月度打卡记录
export const getMonthCheckIns = (year, month) => {
  const params = { year, month }
  return axios.get(`${API_BASE_URL}/check-in/month`, { params }).then(res => res.data)
}

// ===== 设置 API =====
// 7. 获取用户设置
export const getSettings = () =>
  axios.get(`${API_BASE_URL}/settings`).then(res => res.data)

// 8. 更新用户设置
export const updateSettings = (data) =>
  axios.put(`${API_BASE_URL}/settings`, data).then(res => res.data)

// ===== 单词本增删（兼容旧页面）=====
export const createBook = (data) =>
  axios.post(`${API_BASE_URL}/word-books`, data).then(res => res.data)

export const deleteBook = (id) =>
  axios.delete(`${API_BASE_URL}/word-books/${id}`).then(res => res.data)

// ===== 搜索 API =====
export const searchWords = (keyword, type = 'english', page = 1, pageSize = 20) => {
  const params = { q: keyword, type, page, pageSize };
  return axios.get(`${API_BASE_URL}/words/search`, { params }).then(res => res.data);
};

export const getWord = (id) => axios.get(`${API_BASE_URL}/words/${id}`).then(res => res.data);

// ===== 健康检查 =====
export const healthCheck = () => axios.get(`${API_BASE_URL}/health`).then(res => res.data)
