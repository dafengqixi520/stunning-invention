import { Router } from 'express';
import { getPool } from '../database/init.js';

const router = Router();

// 4. POST /api/study-sessions — 记录学习时长和单词数
router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const { duration_seconds, word_count } = req.body;
    console.log('[study-sessions] Received body:', req.body);
    const userId = 1;

    // 参数验证
    if (duration_seconds == null || word_count == null) {
      console.log('[study-sessions] Validation failed: missing fields');
      return res.status(400).json({
        error: '请提供 duration_seconds 和 word_count'
      });
    }

    if (duration_seconds < 0 || word_count < 0) {
      return res.status(400).json({
        error: 'duration_seconds 和 word_count 必须是非负整数'
      });
    }

    const startTime = new Date().toISOString();

    const [result] = await pool.query(
      'INSERT INTO study_sessions (user_id, start_time, duration_seconds, word_count) VALUES (?, ?, ?, ?)',
      [userId, startTime, duration_seconds, word_count]
    );

    res.status(201).json({
      message: '学习记录创建成功',
      id: result.insertId,
      user_id: userId,
      start_time: startTime,
      duration_seconds,
      word_count
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/study-sessions/week — 最近7天学习统计
router.get('/week', async (req, res) => {
  try {
    const pool = getPool();
    const userId = 1;
    const today = new Date().toISOString().split('T')[0];

    // 最近7天每日汇总
    const [dailyRows] = await pool.query(
      `SELECT DATE_FORMAT(DATE(start_time), '%Y-%m-%d') as date,
              COALESCE(SUM(duration_seconds), 0) as total_duration,
              COALESCE(SUM(word_count), 0) as total_words
       FROM study_sessions
       WHERE user_id = ? AND DATE(start_time) >= DATE_SUB(?, INTERVAL 6 DAY)
       GROUP BY DATE_FORMAT(DATE(start_time), '%Y-%m-%d')
       ORDER BY date ASC`,
      [userId, today]
    );

    // 今日汇总
    const [todayRows] = await pool.query(
      `SELECT COALESCE(SUM(duration_seconds), 0) AS total_duration,
              COALESCE(SUM(word_count), 0) AS total_words
       FROM study_sessions
       WHERE user_id = ? AND DATE(start_time) = ?`,
      [userId, today]
    );

    // 本周汇总（周一起始）
    const [weekRows] = await pool.query(
      `SELECT COALESCE(SUM(duration_seconds), 0) AS total_duration,
              COALESCE(SUM(word_count), 0) AS total_words
       FROM study_sessions
       WHERE user_id = ?
         AND YEARWEEK(DATE(start_time), 1) = YEARWEEK(?, 1)`,
      [userId, today]
    );

    // 构建完整的7天数据（填充缺失日期）
    const dailyMap = {};
    for (const row of dailyRows) {
      dailyMap[row.date] = {
        date: row.date,
        duration_seconds: row.total_duration || 0,
        word_count: row.total_words || 0
      };
    }

    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      last7Days.push(dailyMap[dateStr] || {
        date: dateStr,
        duration_seconds: 0,
        word_count: 0
      });
    }

    res.json({
      today: {
        date: today,
        duration_seconds: todayRows[0].total_duration,
        word_count: todayRows[0].total_words
      },
      week: {
        duration_seconds: weekRows[0].total_duration,
        word_count: weekRows[0].total_words
      },
      daily: last7Days
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
