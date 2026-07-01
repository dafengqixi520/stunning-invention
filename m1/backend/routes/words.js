import { Router } from 'express';
import { getPool } from '../database/init.js';

const router = Router();

import fs from 'fs';
import path from 'path';

const logFile = path.join(process.cwd(), 'search.log');
function log(message) {
  const line = `[${new Date().toISOString()}] ${message}\n`;
  fs.appendFileSync(logFile, line);
}

// 搜索单词
router.get('/search', async (req, res) => {
  try {
    const { q, type = 'english', page = 1, pageSize = 20 } = req.query;
    const pageNum = parseInt(page) || 1;
    const pageSizeNum = parseInt(pageSize) || 20;
    log(`收到搜索请求: q=${q}, type=${type}, page=${pageNum}, pageSize=${pageSizeNum}, ua=${req.headers['user-agent']?.slice(0, 50)}`);
    
    if (!q || q.trim().length === 0) {
      log('返回空结果: 关键词为空');
      return res.json({ results: [], total: 0 });
    }

    const pool = getPool();
    const offset = (pageNum - 1) * pageSizeNum;
    const keyword = q.trim();

    let query, params;

    if (type === 'chinese') {
      // 中文搜索：释义包含匹配
      query = `
        SELECT w.*,
               CASE
                 WHEN w.meaning LIKE ? THEN 3
                 WHEN w.meaning LIKE ? THEN 2
                 ELSE 1
               END AS relevance
        FROM words w
        WHERE w.meaning LIKE ?
        ORDER BY relevance DESC, LENGTH(w.word), frequency DESC
        LIMIT ? OFFSET ?
      `;
      params = [`%${keyword}%`, `%${keyword}%`, `%${keyword}%`, pageSizeNum, offset];
      var countQuery = 'SELECT COUNT(*) as total FROM words WHERE meaning LIKE ?';
      var countParams = [`%${keyword}%`];
    } else {
      // 英文搜索：精确 > 前缀 > 包含，三级匹配
      query = `
        SELECT w.*,
               CASE
                 WHEN w.word = ? THEN 3
                 WHEN w.word LIKE ? THEN 2
                 WHEN w.word LIKE ? THEN 1
                 ELSE 0
               END AS relevance
        FROM words w
        WHERE w.word LIKE ?
        ORDER BY relevance DESC, LENGTH(w.word), frequency DESC
        LIMIT ? OFFSET ?
      `;
      params = [keyword, `${keyword}%`, `%${keyword}%`, `%${keyword}%`, pageSizeNum, offset];
      var countQuery = 'SELECT COUNT(*) as total FROM words WHERE word LIKE ?';
      var countParams = [`%${keyword}%`];
    }

    const [rows] = await pool.query(query, params);
    const [countRows] = await pool.query(countQuery, countParams);

    log(`返回结果: 找到 ${countRows[0].total} 个, 返回 ${rows.length} 条`);
    res.json({
      results: rows,
      total: countRows[0].total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (error) {
    log(`搜索错误: ${error.message}`);
    console.error('搜索错误:', error);
    res.status(500).json({ error: error.message });
  }
});

// 获取所有单词
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM words ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个单词
router.get('/:id', async (req, res) => {
  try {
    const pool = getPool();
    const [rows] = await pool.query('SELECT * FROM words WHERE id = ?', [req.params.id]);
    
    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      res.status(404).json({ error: '单词未找到' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加单词
router.post('/', async (req, res) => {
  try {
    const { word, phonetic, meaning, example, difficulty } = req.body;
    const pool = getPool();
    
    await pool.query(
      'INSERT INTO words (word, phonetic, meaning, example, difficulty) VALUES (?, ?, ?, ?, ?)',
      [word, phonetic, meaning, example, difficulty || 1]
    );
    
    res.status(201).json({ message: '单词添加成功', word });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: '单词已存在' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// 更新单词
router.put('/:id', async (req, res) => {
  try {
    const { word, phonetic, meaning, example, difficulty } = req.body;
    const pool = getPool();
    
    const [result] = await pool.query(
      'UPDATE words SET word = ?, phonetic = ?, meaning = ?, example = ?, difficulty = ? WHERE id = ?',
      [word, phonetic, meaning, example, difficulty, req.params.id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '单词未找到' });
    }
    
    res.json({ message: '单词更新成功' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ error: '单词已存在' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// 删除单词
router.delete('/:id', async (req, res) => {
  try {
    const pool = getPool();
    const [result] = await pool.query('DELETE FROM words WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '单词未找到' });
    }
    
    res.json({ message: '单词删除成功' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
