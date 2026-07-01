import express from 'express';
import cors from 'cors';
import { initDatabase, closeDatabase } from './database/init.js';
import bookRoutes from './routes/books.js';
import userWordRoutes from './routes/userWords.js';
import studySessionRoutes from './routes/studySessions.js';
import checkInRoutes from './routes/checkIn.js';
import settingsRoutes from './routes/settings.js';
import wordRoutes from './routes/words.js';

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());

// 请求日志中间件
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// 路由
app.use('/api/word-books', bookRoutes);
app.use('/api/user-words', userWordRoutes);
app.use('/api/study-sessions', studySessionRoutes);
app.use('/api/check-in', checkInRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/words', wordRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库
    await initDatabase();

    // 启动服务器
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });

    // 优雅关闭
    process.on('SIGINT', async () => {
      console.log('\n正在关闭服务器...');
      await closeDatabase();
      process.exit(0);
    });

  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

startServer();
