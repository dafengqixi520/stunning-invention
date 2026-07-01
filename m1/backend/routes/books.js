import { Router } from 'express';
import { getPool } from '../database/init.js';

const router = Router();

// 1. GET /api/word-books — 返回所有单词书列表（含学习统计）
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const userId = 1;

    const [rows] = await pool.query(
      `SELECT
         wb.id,
         wb.name,
         wb.total_words,
         COUNT(DISTINCT w.id) AS total_words_actual,
         COUNT(DISTINCT CASE WHEN uw.status = 'mastered' THEN w.id END) AS mastered_count,
         COUNT(DISTINCT CASE WHEN uw.status = 'learning' THEN w.id END) AS learning_count
       FROM word_books wb
       LEFT JOIN words w ON w.word_book_id = wb.id
       LEFT JOIN user_words uw ON uw.word_id = w.id AND uw.user_id = ?
       GROUP BY wb.id, wb.name, wb.total_words
       ORDER BY wb.id ASC`,
      [userId]
    );

    // 格式化返回数据
    const books = rows.map(row => ({
      id: row.id,
      name: row.name,
      total_words: row.total_words_actual || row.total_words,
      mastered_count: row.mastered_count || 0,
      learning_count: row.learning_count || 0,
      new_count: (row.total_words_actual || row.total_words) - (row.mastered_count || 0) - (row.learning_count || 0),
      mastery_rate: (row.total_words_actual || row.total_words) > 0
        ? Math.round(((row.mastered_count || 0) / (row.total_words_actual || row.total_words)) * 100)
        : 0
    }));

    res.json(books);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. GET /api/word-books/:id/words?status=new&limit=10 — 根据单词书ID获取单词
router.get('/:id/words', async (req, res) => {
  try {
    const pool = getPool();
    const { id } = req.params;
    const { status, limit } = req.query;
    const userId = 1; // 固定单用户

    let query;
    let params;

    if (status) {
      // 按用户单词状态筛选
      // LEFT JOIN user_words：未在 user_words 中的单词视为 status='new'
      query = `
        SELECT w.id, w.word, w.phonetic, w.meaning, w.example,
               w.pos, w.difficulty, w.frequency, w.bnc, w.collins,
               COALESCE(uw.status, 'new') AS status,
               uw.last_review_date, uw.next_review_date, uw.review_count
        FROM words w
        LEFT JOIN user_words uw ON w.id = uw.word_id AND uw.user_id = ?
        WHERE w.word_book_id = ?
          AND COALESCE(uw.status, 'new') = ?
        ORDER BY w.bnc ASC, w.id ASC
      `;
      params = [userId, id, status];
    } else {
      query = `
        SELECT w.id, w.word, w.phonetic, w.meaning, w.example,
               w.pos, w.difficulty, w.frequency, w.bnc, w.collins,
               uw.status, uw.last_review_date, uw.next_review_date, uw.review_count
        FROM words w
        LEFT JOIN user_words uw ON w.id = uw.word_id AND uw.user_id = ?
        WHERE w.word_book_id = ?
        ORDER BY w.bnc ASC, w.id ASC
      `;
      params = [userId, id];
    }

    // 支持 limit 分页
    if (limit) {
      query += ' LIMIT ?';
      params.push(parseInt(limit, 10));
    }

    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/word-books — 创建单词书
router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { name, total_words } = req.body;

    if (!name) {
      return res.status(400).json({ error: '单词书名称不能为空' });
    }

    const [result] = await pool.query(
      'INSERT INTO word_books (name, total_words) VALUES (?, ?)',
      [name, total_words || 0]
    );

    res.status(201).json({
      message: '单词书创建成功',
      id: result.insertId,
      name,
      total_words: total_words || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/word-books/:id — 删除单词书
router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    const [result] = await pool.query('DELETE FROM word_books WHERE id = ?', [req.params.id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '单词书未找到' });
    }

    res.json({ message: '单词书删除成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
