/**
 * ECDICT CSV 导入模块
 *
 * 从 skywind3000/ECDICT 的 ecdict.csv 中提取单词数据并导入 MySQL。
 *
 * CSV 列顺序（0-based）：
 *   0: word        1: phonetic    2: definition     3: translation
 *   4: pos         5: collins     6: oxford         7: tag
 *   8: bnc         9: frq         10: exchange      11: example
 *   12: example_translation
 */

import { createReadStream } from 'fs';
import { parse } from 'csv-parse';

// 考试标签 → 单词书名称映射
const TAG_BOOK_MAP = [
  { tag: 'cet4',  name: 'CET-4 四级词汇',   priority: 1 },
  { tag: 'cet6',  name: 'CET-6 六级词汇',   priority: 2 },
  { tag: 'ky',    name: '考研词汇',          priority: 3 },
  { tag: 'toefl', name: 'TOEFL 托福词汇',    priority: 4 },
  { tag: 'ielts', name: 'IELTS 雅思词汇',    priority: 5 },
  { tag: 'gre',   name: 'GRE 词汇',          priority: 6 },
];

// 默认通用词库
const DEFAULT_BOOK = { name: '综合词库', priority: 99 };

const BATCH_SIZE = 500;   // 每批 INSERT 行数
const MAX_WORDS = 10000;  // MVP 上限（如需更多可调大）

export async function importEcdictCsv(pool, csvPath) {
  const bookIdMap = {};        // tag → book_id
  const wordBuffer = [];       // 待插入的单词行
  let totalImported = 0;
  let totalScanned = 0;

  // 1. 创建单词书
  console.log('  → 创建单词书...');
  for (const entry of TAG_BOOK_MAP) {
    const [result] = await pool.query(
      'INSERT INTO word_books (name, total_words) VALUES (?, 0) ON DUPLICATE KEY UPDATE name=name',
      [entry.name]
    );
    // ON DUPLICATE KEY 返回 0 如果没变更，需要额外查询
    const [rows] = await pool.query('SELECT id FROM word_books WHERE name = ?', [entry.name]);
    bookIdMap[entry.tag] = rows[0].id;
    console.log(`    ${entry.name} → book_id=${rows[0].id}`);
  }

  // 综合词库
  const [genResult] = await pool.query(
    'INSERT INTO word_books (name, total_words) VALUES (?, 0) ON DUPLICATE KEY UPDATE name=name',
    [DEFAULT_BOOK.name]
  );
  const [genRows] = await pool.query('SELECT id FROM word_books WHERE name = ?', [DEFAULT_BOOK.name]);
  const generalBookId = genRows[0].id;
  console.log(`    ${DEFAULT_BOOK.name} → book_id=${generalBookId}`);

  // 2. 清空旧的 ECDICT 数据（按 tag 不为空判断）
  await pool.query('DELETE FROM words WHERE tag IS NOT NULL AND tag != \'\'');

  // 3. 流式解析 CSV 并批量写入
  console.log('  → 解析 CSV 并导入...');

  const parser = createReadStream(csvPath, { encoding: 'utf-8' }).pipe(
    parse({
      delimiter: ',',
      quote: '"',
      escape: '"',
      relaxColumnCount: true,
      skipEmptyLines: true,
      trim: true,
    })
  );

  let headerSkipped = false;

  for await (const record of parser) {
    totalScanned++;

    // 跳过 CSV 表头行（首字段为 "word" 则视为表头）
    if (!headerSkipped && record[0] && record[0].toLowerCase() === 'word') {
      headerSkipped = true;
      continue;
    }
    headerSkipped = true;

    if (totalImported >= MAX_WORDS) break;

    const word    = record[0];
    const phonetic = record[1] || '';
    const definition = record[2] || '';
    const translation = record[3] || '';
    const pos     = record[4] || '';
    const collins = parseInt(record[5]) || 0;
    const tag     = record[7] || '';
    const bnc     = parseInt(record[8]) || null;
    const frq     = parseFloat(record[9]) || 0;
    const example = record[11] || '';  // 例句字段
    const exampleTranslation = record[12] || '';  // 例句翻译字段

    // 过滤：必须有单词和释义，且有 BNC 排名或考试标签
    if (!word || !translation) continue;
    if (!bnc && !tag) continue;

    // 确定所属单词书（按优先级分配）
    let bookId = generalBookId;
    for (const entry of TAG_BOOK_MAP) {
      if (tag.includes(entry.tag)) {
        bookId = bookIdMap[entry.tag];
        break;
      }
    }

    // 难度映射：collins 0-5 → 1-5，0 表示未评级默认为 1
    const difficulty = collins > 0 ? collins : 1;

    wordBuffer.push([
      bookId,
      word,
      phonetic,
      translation,           // meaning 用中文释义
      example,               // 例句
      exampleTranslation,    // 例句翻译
      pos,
      frq,                    // frequency
      difficulty,
      collins,
      bnc,
      tag
    ]);

    // 批量写入
    if (wordBuffer.length >= BATCH_SIZE) {
      await flushBatch(pool, wordBuffer);
      totalImported += wordBuffer.length;
      wordBuffer.length = 0;
      if (totalImported % 2000 === 0) {
        console.log(`    已导入 ${totalImported} 个单词...`);
      }
    }
  }

  // 写入剩余
  if (wordBuffer.length > 0) {
    await flushBatch(pool, wordBuffer);
    totalImported += wordBuffer.length;
    wordBuffer.length = 0;
  }

  // 4. 更新各单词书的 total_words 计数
  console.log('  → 更新单词书统计...');
  await pool.query(`
    UPDATE word_books wb
    SET total_words = (SELECT COUNT(*) FROM words w WHERE w.word_book_id = wb.id)
  `);

  console.log(`  ✅ 导入完成：扫描 ${totalScanned} 行，导入 ${totalImported} 个单词`);
  return { totalImported, totalScanned };
}

// 批量 INSERT
async function flushBatch(pool, buffer) {
  if (buffer.length === 0) return;

  const placeholders = buffer.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
  const values = buffer.flat();

  await pool.query(
    `INSERT IGNORE INTO words
     (word_book_id, word, phonetic, meaning, example, example_translation, pos, frequency, difficulty, collins, bnc, tag)
     VALUES ${placeholders}`,
    values
  );
}
