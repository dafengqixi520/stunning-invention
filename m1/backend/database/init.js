import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '.env') });

let pool = null;

// 创建数据库连接池
export async function initDatabase() {
  // 首先连接到 MySQL 服务器（不指定数据库）
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  });

  // 创建数据库（如果不存在）
  const dbName = process.env.DB_NAME || 'vocabulary_db';
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.end();

  // 创建连接池
  pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: dbName,
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // 创建表
  await createTables();

  // 检查是否需要插入初始数据
  await insertInitialData();

  console.log('MySQL 数据库初始化成功');
  return pool;
}

// 创建表
async function createTables() {
  const connection = await pool.getConnection();

  try {
    // 1. word_books（单词书）
    await connection.query(`
      CREATE TABLE IF NOT EXISTS word_books (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL,
        total_words INTEGER DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 2. words（单词）—— 含 ECDICT 扩展字段
    await connection.query(`
      CREATE TABLE IF NOT EXISTS words (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        word_book_id INTEGER NOT NULL,
        word VARCHAR(200) NOT NULL,
        phonetic VARCHAR(200),
        meaning TEXT NOT NULL,
        example TEXT,
        pos VARCHAR(20),
        frequency REAL DEFAULT 0,
        difficulty INTEGER DEFAULT 1,
        collins INTEGER DEFAULT 0,
        bnc INTEGER,
        tag TEXT,
        FOREIGN KEY (word_book_id) REFERENCES word_books(id) ON DELETE CASCADE,
        UNIQUE KEY unique_word_per_book (word_book_id, word),
        INDEX idx_tag (tag(100)),
        INDEX idx_bnc (bnc),
        INDEX idx_word (word(50)),
        FULLTEXT INDEX ft_meaning (meaning)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // ECDICT 字段迁移（对已有表补列）
    await migrateWordsTable(connection);

    // 3. user_words（用户单词状态）
    await connection.query(`
      CREATE TABLE IF NOT EXISTS user_words (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        user_id INTEGER NOT NULL DEFAULT 1,
        word_id INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'new',
        last_review_date VARCHAR(10),
        next_review_date VARCHAR(10),
        review_count INTEGER DEFAULT 0,
        FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_word (user_id, word_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 4. study_sessions（学习记录）
    await connection.query(`
      CREATE TABLE IF NOT EXISTS study_sessions (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        user_id INTEGER NOT NULL DEFAULT 1,
        start_time TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL DEFAULT 0,
        word_count INTEGER NOT NULL DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 5. check_ins（打卡记录）
    await connection.query(`
      CREATE TABLE IF NOT EXISTS check_ins (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        user_id INTEGER NOT NULL DEFAULT 1,
        date VARCHAR(10) NOT NULL,
        is_compensated INTEGER DEFAULT 0,
        UNIQUE KEY unique_user_date (user_id, date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 6. settings（用户设置）
    await connection.query(`
      CREATE TABLE IF NOT EXISTS settings (
        user_id INTEGER PRIMARY KEY DEFAULT 1,
        daily_new_words INTEGER DEFAULT 10,
        daily_review_target INTEGER DEFAULT 20,
        order_type VARCHAR(20) DEFAULT 'default'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('数据表创建成功');
  } finally {
    connection.release();
  }
}

// 插入初始数据
async function insertInitialData() {
  const connection = await pool.getConnection();

  try {
    // 检查是否已有单词书数据
    const [bookRows] = await connection.query('SELECT COUNT(*) as count FROM word_books');

    if (bookRows[0].count === 0) {
      // 尝试从 ECDICT CSV 导入——若文件存在则导入，否则使用内置示例数据
      const ecdictSamplePath = join(__dirname, '..', 'ecdict_sample.csv');
      const ecdictPath = join(__dirname, '..', 'ecdict.csv');
      // 优先使用完整版，回退到示例版
      const actualPath = existsSync(ecdictPath) ? ecdictPath :
                         existsSync(ecdictSamplePath) ? ecdictSamplePath : null;
      const fs = await import('fs');

      if (actualPath) {
        console.log(`发现词库文件，开始导入...`);
        try {
          const { importEcdictCsv } = await import('./importEcdict.js');
          await importEcdictCsv(pool, actualPath);
          console.log('ECDICT 导入完成');

          // 插入默认用户设置
          await connection.query(
            "INSERT IGNORE INTO settings (user_id, daily_new_words, daily_review_target, order_type) VALUES (1, 10, 20, 'default')"
          );
          return;
        } catch (err) {
          console.error('ECDICT 导入失败，回退到示例数据:', err.message);
        }
      }

      // 回退：内置示例数据
      // 插入 CET-4 单词书
      await connection.query(
        "INSERT INTO word_books (name, total_words) VALUES ('CET-4 四级词汇', 20)"
      );

      // 插入 CET-6 单词书
      await connection.query(
        "INSERT INTO word_books (name, total_words) VALUES ('CET-6 六级词汇', 15)"
      );

      // 插入考研单词书
      await connection.query(
        "INSERT INTO word_books (name, total_words) VALUES ('考研词汇', 10)"
      );

      // 插入 CET-4 单词（word_book_id = 1）
      const cet4Words = [
        ['abandon', '/əˈbændən/', 'v. 放弃；抛弃', 'He abandoned his plan to travel.'],
        ['ability', '/əˈbɪləti/', 'n. 能力；才能', 'She has the ability to solve complex problems.'],
        ['abroad', '/əˈbrɔːd/', 'adv. 在国外；到国外', 'He dreams of studying abroad.'],
        ['absent', '/ˈæbsənt/', 'adj. 缺席的；不在的', 'Tom was absent from school yesterday.'],
        ['absolute', '/ˈæbsəluːt/', 'adj. 绝对的；完全的', 'I have absolute trust in her.'],
        ['absorb', '/əbˈzɔːrb/', 'v. 吸收；吸引', 'Plants absorb water from the soil.'],
        ['abstract', '/ˈæbstrækt/', 'adj. 抽象的 n. 摘要', 'The concept is too abstract to understand.'],
        ['abundant', '/əˈbʌndənt/', 'adj. 丰富的；充裕的', 'The region has abundant natural resources.'],
        ['academic', '/ˌækəˈdemɪk/', 'adj. 学术的；学院的', 'She has excellent academic records.'],
        ['accelerate', '/əkˈseləreɪt/', 'v. 加速；促进', 'The car accelerated quickly.'],
        ['access', '/ˈækses/', 'n. 通道；进入权 v. 访问', 'You need a password to access the system.'],
        ['accompany', '/əˈkʌmpəni/', 'v. 陪伴；伴随', 'I will accompany you to the station.'],
        ['accomplish', '/əˈkɑːmplɪʃ/', 'v. 完成；实现', 'We accomplished our mission.'],
        ['accurate', '/ˈækjərət/', 'adj. 准确的；精确的', 'The data is accurate and reliable.'],
        ['achieve', '/əˈtʃiːv/', 'v. 达到；取得', 'She achieved her goal of becoming a doctor.'],
        ['acknowledge', '/əkˈnɑːlɪdʒ/', 'v. 承认；确认', 'He acknowledged his mistake.'],
        ['acquire', '/əˈkwaɪər/', 'v. 获得；学到', 'It takes time to acquire new skills.'],
        ['adapt', '/əˈdæpt/', 'v. 适应；改编', 'You need to adapt to the new environment.'],
        ['adequate', '/ˈædɪkwət/', 'adj. 足够的；适当的', 'The supply is adequate for our needs.'],
        ['adjust', '/əˈdʒʌst/', 'v. 调整；适应', 'Please adjust the volume to a comfortable level.']
      ];

      for (const word of cet4Words) {
        await connection.query(
          'INSERT INTO words (word_book_id, word, phonetic, meaning, example) VALUES (1, ?, ?, ?, ?)',
          word
        );
      }

      // 插入 CET-6 单词（word_book_id = 2）
      const cet6Words = [
        ['ambiguous', '/æmˈbɪɡjuəs/', 'adj. 模棱两可的；含糊的', 'The statement was intentionally ambiguous.'],
        ['benevolent', '/bəˈnevələnt/', 'adj. 仁慈的；慈善的', 'The benevolent donor gave millions to charity.'],
        ['comprehensive', '/ˌkɑːmprɪˈhensɪv/', 'adj. 全面的；综合的', 'We conducted a comprehensive review.'],
        ['deteriorate', '/dɪˈtɪriəreɪt/', 'v. 恶化；退化', 'His health began to deteriorate rapidly.'],
        ['elaborate', '/ɪˈlæbərət/', 'adj. 精心制作的 v. 详细说明', 'She gave an elaborate explanation.'],
        ['fluctuate', '/ˈflʌktʃueɪt/', 'v. 波动；起伏', 'Stock prices fluctuate daily.'],
        ['generalize', '/ˈdʒenrəlaɪz/', 'v. 概括；归纳', 'It is unfair to generalize from one example.'],
        ['homogeneous', '/ˌhoʊməˈdʒiːniəs/', 'adj. 同质的；均匀的', 'The population is largely homogeneous.'],
        ['illuminate', '/ɪˈluːmɪneɪt/', 'v. 照亮；阐明', 'The report illuminates the key issues.'],
        ['jeopardize', '/ˈdʒepərdaɪz/', 'v. 危及；损害', 'The scandal could jeopardize his career.'],
        ['magnificent', '/mæɡˈnɪfɪsnt/', 'adj. 壮丽的；宏伟的', 'The view from the top was magnificent.'],
        ['notorious', '/noʊˈtɔːriəs/', 'adj. 声名狼藉的', 'He is notorious for being late.'],
        ['predominant', '/prɪˈdɑːmɪnənt/', 'adj. 主要的；占优势的', 'English is the predominant language here.'],
        ['rigorous', '/ˈrɪɡərəs/', 'adj. 严格的；严密的', 'The product undergoes rigorous testing.'],
        ['sophisticated', '/səˈfɪstɪkeɪtɪd/', 'adj. 复杂的；精密的；老练的', 'She is a sophisticated woman with refined taste.']
      ];

      for (const word of cet6Words) {
        await connection.query(
          'INSERT INTO words (word_book_id, word, phonetic, meaning, example) VALUES (2, ?, ?, ?, ?)',
          word
        );
      }

      // 插入考研单词（word_book_id = 3）
      const kaoyanWords = [
        ['abolish', '/əˈbɑːlɪʃ/', 'v. 废除；取消', 'The government plans to abolish the outdated law.'],
        ['bureaucracy', '/bjʊˈrɑːkrəsi/', 'n. 官僚机构；官僚主义', 'Red tape and bureaucracy slow down progress.'],
        ['consolidate', '/kənˈsɑːlɪdeɪt/', 'v. 巩固；合并', 'We need to consolidate our market position.'],
        ['discrepancy', '/dɪsˈkrepənsi/', 'n. 差异；不一致', 'There is a discrepancy between the two reports.'],
        ['empirical', '/ɪmˈpɪrɪkl/', 'adj. 经验主义的；以实验为依据的', 'The theory lacks empirical evidence.'],
        ['formidable', '/ˈfɔːrmɪdəbl/', 'adj. 可怕的；令人敬畏的', 'They faced formidable challenges.'],
        ['hypothesis', '/haɪˈpɑːθəsɪs/', 'n. 假说；假设', 'The scientist tested her hypothesis.'],
        ['inevitable', '/ɪnˈevɪtəbl/', 'adj. 不可避免的', 'Change is inevitable in life.'],
        ['legitimate', '/lɪˈdʒɪtɪmət/', 'adj. 合法的；正当的', 'He has a legitimate reason for being absent.'],
        ['monopoly', '/məˈnɑːpəli/', 'n. 垄断；独占', 'The company has a monopoly on the market.']
      ];

      for (const word of kaoyanWords) {
        await connection.query(
          'INSERT INTO words (word_book_id, word, phonetic, meaning, example) VALUES (3, ?, ?, ?, ?)',
          word
        );
      }

      // 插入默认用户设置
      await connection.query(
        "INSERT IGNORE INTO settings (user_id, daily_new_words, daily_review_target, order_type) VALUES (1, 10, 20, 'default')"
      );

      console.log('初始数据插入成功');
    }
  } finally {
    connection.release();
  }
}

// 迁移已有 words 表：添加 ECDICT 字段
async function migrateWordsTable(connection) {
  const migrations = [
    `ALTER TABLE words ADD COLUMN pos VARCHAR(20)`,
    `ALTER TABLE words ADD COLUMN frequency REAL DEFAULT 0`,
    `ALTER TABLE words ADD COLUMN difficulty INTEGER DEFAULT 1`,
    `ALTER TABLE words ADD COLUMN collins INTEGER DEFAULT 0`,
    `ALTER TABLE words ADD COLUMN bnc INTEGER`,
    `ALTER TABLE words ADD COLUMN tag TEXT`,
    `ALTER TABLE words ADD COLUMN example_translation TEXT`,
    `ALTER TABLE words ADD INDEX idx_word (word(50))`,
    `ALTER TABLE words ADD FULLTEXT INDEX ft_meaning (meaning)`
  ];

  for (const sql of migrations) {
    try {
      await connection.query(sql);
    } catch (err) {
      // 字段已存在则跳过（MySQL errno 1060），索引已存在则跳过（MySQL errno 1061）
      if (err.errno !== 1060 && err.errno !== 1061) throw err;
    }
  }
}

// 获取数据库连接池
export function getPool() {
  return pool;
}

// 关闭数据库连接
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
