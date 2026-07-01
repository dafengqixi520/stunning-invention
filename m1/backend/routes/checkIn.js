import { Router } from 'express';
import { getPool } from '../database/init.js';

const router = Router();

// 5. GET /api/check-in/today — 返回今日是否已打卡
router.get('/today', async (req, res) => {
  try {
    const pool = getPool();
    const userId = 1;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const [rows] = await pool.query(
      'SELECT * FROM check_ins WHERE user_id = ? AND date = ?',
      [userId, today]
    );

    if (rows.length > 0) {
      res.json({
        checked_in: true,
        is_compensated: rows[0].is_compensated === 1,
        date: today
      });
    } else {
      res.json({
        checked_in: false,
        date: today
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. POST /api/check-in — 执行打卡
router.post('/', async (req, res) => {
  try {
    const pool = getPool();
    const userId = 1;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // 检查今日是否已打卡
    const [existingRows] = await pool.query(
      'SELECT * FROM check_ins WHERE user_id = ? AND date = ?',
      [userId, today]
    );

    if (existingRows.length > 0) {
      return res.status(400).json({
        error: '今日已打卡，每天只能打卡一次',
        check_in: existingRows[0]
      });
    }

    // 规则：今日累计学习时长 >= 60秒 或 学习单词数 >= 5 才允许打卡
    // 查询今日所有学习记录
    const [sessionRows] = await pool.query(
      `SELECT COALESCE(SUM(duration_seconds), 0) AS total_duration,
              COALESCE(SUM(word_count), 0) AS total_words
       FROM study_sessions
       WHERE user_id = ? AND DATE(start_time) = ?`,
      [userId, today]
    );

    const totalDuration = sessionRows[0].total_duration;
    const totalWords = sessionRows[0].total_words;

    if (totalDuration < 60 && totalWords < 5) {
      return res.status(400).json({
        error: '不满足打卡条件',
        requirement: '今日学习时长 >= 60秒 或 学习单词数 >= 5',
        current: {
          total_duration_seconds: totalDuration,
          total_words: totalWords
        }
      });
    }

    // 执行打卡
    const [result] = await pool.query(
      'INSERT INTO check_ins (user_id, date, is_compensated) VALUES (?, ?, 0)',
      [userId, today]
    );

    res.status(201).json({
      message: '打卡成功',
      id: result.insertId,
      user_id: userId,
      date: today,
      is_compensated: false,
      today_stats: {
        total_duration_seconds: totalDuration,
        total_words: totalWords
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/check-in/month?year=2026&month=6 — 获取月度打卡记录
router.get('/month', async (req, res) => {
  try {
    const pool = getPool();
    const userId = 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const month = parseInt(req.query.month) || (new Date().getMonth() + 1);
    const monthStr = String(month).padStart(2, '0');
    const prefix = `${year}-${monthStr}`;

    // 当月打卡记录
    const [rows] = await pool.query(
      'SELECT date, is_compensated FROM check_ins WHERE user_id = ? AND date LIKE ? ORDER BY date ASC',
      [userId, `${prefix}%`]
    );

    // 计算连续打卡天数（从昨天往前推）
    const today = new Date().toISOString().split('T')[0];
    const [allRows] = await pool.query(
      'SELECT date FROM check_ins WHERE user_id = ? ORDER BY date DESC',
      [userId]
    );

    let streak = 0;
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - 1); // 从昨天开始算

    // 如果今天也打卡了，从今天开始算
    const todayChecked = allRows.some(r => r.date === today);
    if (todayChecked) {
      streak = 1;
      checkDate.setDate(checkDate.getDate() + 1); // 回到今天
    }

    const dateSet = new Set(allRows.map(r => r.date));
    while (true) {
      const d = checkDate.toISOString().split('T')[0];
      if (dateSet.has(d)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    res.json({
      year,
      month,
      check_ins: rows.map(r => ({
        date: r.date,
        is_compensated: r.is_compensated === 1
      })),
      streak,
      monthly_count: rows.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
