import { Router } from 'express';
import { getPool } from '../database/init.js';

const router = Router();

// 7. GET /api/settings — 获取用户设置
router.get('/', async (req, res) => {
  try {
    const pool = getPool();
    const userId = 1;

    const [rows] = await pool.query(
      'SELECT * FROM settings WHERE user_id = ?',
      [userId]
    );

    if (rows.length > 0) {
      res.json(rows[0]);
    } else {
      // 如果设置不存在，返回默认值
      res.json({
        user_id: userId,
        daily_new_words: 10,
        daily_review_target: 20,
        order_type: 'default'
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. PUT /api/settings — 更新用户设置
router.put('/', async (req, res) => {
  try {
    const pool = getPool();
    const userId = 1;
    const { daily_new_words, daily_review_target, order_type } = req.body;

    // 验证 order_type
    if (order_type && !['default', 'random'].includes(order_type)) {
      return res.status(400).json({
        error: 'order_type 必须是 default 或 random'
      });
    }

    // 验证数值字段
    if (daily_new_words != null && (daily_new_words < 1 || daily_new_words > 200)) {
      return res.status(400).json({
        error: 'daily_new_words 必须在 1-200 之间'
      });
    }

    if (daily_review_target != null && (daily_review_target < 1 || daily_review_target > 500)) {
      return res.status(400).json({
        error: 'daily_review_target 必须在 1-500 之间'
      });
    }

    // 使用 INSERT ... ON DUPLICATE KEY UPDATE
    await pool.query(
      `INSERT INTO settings (user_id, daily_new_words, daily_review_target, order_type)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         daily_new_words = VALUES(daily_new_words),
         daily_review_target = VALUES(daily_review_target),
         order_type = VALUES(order_type)`,
      [
        userId,
        daily_new_words ?? 10,
        daily_review_target ?? 20,
        order_type ?? 'default'
      ]
    );

    // 返回更新后的设置
    const [rows] = await pool.query(
      'SELECT * FROM settings WHERE user_id = ?',
      [userId]
    );

    res.json({
      message: '设置更新成功',
      settings: rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
