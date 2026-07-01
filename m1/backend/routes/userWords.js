import { Router } from 'express';
import { getPool } from '../database/init.js';

const router = Router();

// GET /api/user-words — 获取用户的单词列表
// ?status=new&limit=10          → 获取新词
// ?status=learning&due=true     → 获取待复习单词
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const { status, limit, due } = req.query;
    const userId = 1;
    const today = new Date().toISOString().split('T')[0];

    let query;
    let params;

    if (status === 'new') {
      // 新词：user_words 中无记录 或 status='new'
      const orderType = await getUserOrderType(pool, userId);

      query = `
        SELECT w.id, w.word, w.phonetic, w.meaning, w.example, w.example_translation,
               w.pos, w.difficulty, w.frequency, w.bnc, w.collins,
               COALESCE(uw.status, 'new') AS status,
               uw.last_review_date, uw.next_review_date, uw.review_count
        FROM words w
        LEFT JOIN user_words uw ON w.id = uw.word_id AND uw.user_id = ?
        WHERE COALESCE(uw.status, 'new') = 'new'
        ORDER BY ${orderType === 'random' ? 'RAND()' : 'w.bnc ASC, w.id ASC'}
      `;
      params = [userId];

      if (limit) {
        query += ' LIMIT ?';
        params.push(parseInt(limit, 10));
      }
    } else if (status === 'learning' && due === 'true') {
      // 待复习：status='learning' 且 next_review_date <= 今天
      query = `
        SELECT w.id, w.word, w.phonetic, w.meaning, w.example, w.example_translation,
               w.pos, w.difficulty, w.frequency, w.bnc, w.collins,
               uw.status, uw.last_review_date, uw.next_review_date, uw.review_count
        FROM words w
        JOIN user_words uw ON w.id = uw.word_id AND uw.user_id = ?
        WHERE uw.status = 'learning' AND uw.next_review_date <= ?
        ORDER BY uw.next_review_date ASC
      `;
      params = [userId, today];
    } else {
      return res.status(400).json({ error: '请提供有效的 status 参数 (new 或 learning)' });
    }

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/user-words/:wordId/review — 更新用户单词复习状态
// { status: 'mastered' | 'learning' }
// 可选 { next_review_date: 'YYYY-MM-DD' } — 自定义下次复习日期（用于"不认识"场景）
router.post('/:wordId/review', async (req, res) => {
  try {
    const pool = getPool();
    const { wordId } = req.params;
    const { status, next_review_date } = req.body;
    const userId = 1;

    // 验证 status
    if (!['new', 'learning', 'mastered'].includes(status)) {
      return res.status(400).json({
        error: '无效的状态值，必须是 new / learning / mastered'
      });
    }

    // 验证单词是否存在
    const [wordRows] = await pool.query('SELECT id FROM words WHERE id = ?', [wordId]);
    if (wordRows.length === 0) {
      return res.status(404).json({ error: '单词未找到' });
    }

    // 计算复习日期
    const today = new Date().toISOString().split('T')[0];
    let nextDate;

    if (next_review_date) {
      // 前端指定了下次复习日期（用于"不认识"的场景）
      nextDate = next_review_date;
    } else if (status === 'mastered') {
      const next = new Date();
      next.setDate(next.getDate() + 3);
      nextDate = next.toISOString().split('T')[0];
    } else if (status === 'learning') {
      const next = new Date();
      next.setDate(next.getDate() + 1);
      nextDate = next.toISOString().split('T')[0];
    } else {
      nextDate = today;
    }

    // upsert
    await pool.query(
      `INSERT INTO user_words (user_id, word_id, status, last_review_date, next_review_date, review_count)
       VALUES (?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         status = VALUES(status),
         last_review_date = VALUES(last_review_date),
         next_review_date = VALUES(next_review_date),
         review_count = review_count + 1`,
      [userId, wordId, status, today, nextDate]
    );

    res.json({
      message: '复习状态更新成功',
      word_id: parseInt(wordId, 10),
      status,
      last_review_date: today,
      next_review_date: nextDate
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取用户设置的出词顺序
async function getUserOrderType(pool, userId) {
  try {
    const [rows] = await pool.query(
      'SELECT order_type FROM settings WHERE user_id = ?',
      [userId]
    );
    return rows.length > 0 ? rows[0].order_type : 'default';
  } catch {
    return 'default';
  }
}

export default router;
