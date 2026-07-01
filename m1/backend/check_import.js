#!/usr/bin/env node

/**
 * ECDICT 导入验证脚本
 *
 * 用法:
 *   cd backend && node check_import.js
 */

import { initDatabase, closeDatabase, getPool } from './database/init.js';

async function main() {
  console.log('🔍 ECDICT 导入验证');
  console.log('═'.repeat(50));

  // 连接数据库
  await initDatabase();
  const pool = getPool();

  let issues = [];
  let totalCount = 0;

  try {
    // ===============================================
    // 1. 总单词数
    // ===============================================
    console.log('');
    console.log('📊 1. 单词总数');

    const [totalRows] = await pool.query('SELECT COUNT(*) AS count FROM words');
    totalCount = totalRows[0].count;
    console.log(`   words 表总记录: ${totalCount.toLocaleString()}`);

    if (totalCount === 0) {
      issues.push('words 表为空，导入可能未执行或失败');
    }

    // 各单词书统计
    const [bookStats] = await pool.query(`
      SELECT wb.name, COUNT(w.id) AS cnt
      FROM word_books wb
      LEFT JOIN words w ON w.word_book_id = wb.id
      GROUP BY wb.id, wb.name
      ORDER BY wb.id
    `);
    console.log('   各单词书分布:');
    for (const row of bookStats) {
      console.log(`     - ${row.name}: ${row.cnt} 词`);
    }

    // ===============================================
    // 2. 前 5 条记录
    // ===============================================
    console.log('');
    console.log('📋 2. 前 5 条记录');

    const [firstRows] = await pool.query(`
      SELECT id, word, phonetic, meaning, pos, difficulty, bnc, tag
      FROM words
      ORDER BY id ASC
      LIMIT 5
    `);

    for (const row of firstRows) {
      const tag = row.tag ? ` [${row.tag}]` : '';
      console.log(`   #${row.id}  ${row.word.padEnd(16)} ${(row.phonetic || '').padEnd(22)} ${(row.meaning || '').slice(0, 40)}${tag}`);
    }

    if (firstRows.length === 0) {
      issues.push('无法读取前 5 条记录');
    }

    // ===============================================
    // 3. 最后 5 条记录
    // ===============================================
    console.log('');
    console.log('📋 3. 最后 5 条记录');

    const [lastRows] = await pool.query(`
      SELECT id, word, phonetic, meaning, pos, difficulty, bnc, tag
      FROM words
      ORDER BY id DESC
      LIMIT 5
    `);

    for (const row of lastRows.reverse()) {
      const tag = row.tag ? ` [${row.tag}]` : '';
      console.log(`   #${row.id}  ${row.word.padEnd(16)} ${(row.phonetic || '').padEnd(22)} ${(row.meaning || '').slice(0, 40)}${tag}`);
    }

    if (lastRows.length === 0) {
      issues.push('无法读取最后 5 条记录');
    }

    // ===============================================
    // 4. 空值 / 异常数据检查
    // ===============================================
    console.log('');
    console.log('🔬 4. 数据质量检查');

    // 4a. word 为空
    const [emptyWord] = await pool.query(
      "SELECT COUNT(*) AS count FROM words WHERE word IS NULL OR word = ''"
    );
    if (emptyWord[0].count > 0) {
      issues.push(`word 为空的记录: ${emptyWord[0].count} 条`);
      console.log(`   ⚠️  word 为空: ${emptyWord[0].count} 条`);
    } else {
      console.log('   ✅ word 列无空值');
    }

    // 4b. meaning 为空
    const [emptyMeaning] = await pool.query(
      "SELECT COUNT(*) AS count FROM words WHERE meaning IS NULL OR meaning = ''"
    );
    if (emptyMeaning[0].count > 0) {
      issues.push(`meaning 为空的记录: ${emptyMeaning[0].count} 条`);
      console.log(`   ⚠️  meaning 为空: ${emptyMeaning[0].count} 条`);
    } else {
      console.log('   ✅ meaning 列无空值');
    }

    // 4c. phonetic 为空的比例
    const [emptyPhonetic] = await pool.query(
      "SELECT COUNT(*) AS count FROM words WHERE phonetic IS NULL OR phonetic = ''"
    );
    const phoneticEmptyRate = totalCount > 0
      ? ((emptyPhonetic[0].count / totalCount) * 100).toFixed(1)
      : 0;
    if (emptyPhonetic[0].count > totalCount * 0.5) {
      issues.push(`phonetic 缺失过多: ${emptyPhonetic[0].count}/${totalCount} (${phoneticEmptyRate}%)`);
      console.log(`   ⚠️  phonetic 缺失: ${emptyPhonetic[0].count} 条 (${phoneticEmptyRate}%)`);
    } else {
      console.log(`   ✅ phonetic 缺失: ${emptyPhonetic[0].count} 条 (${phoneticEmptyRate}%)`);
    }

    // 4d. tag 和 bnc 同时为空（异常：导入条件要求至少一个有值）
    const [noTagNoBnc] = await pool.query(`
      SELECT COUNT(*) AS count FROM words
      WHERE (tag IS NULL OR tag = '') AND (bnc IS NULL OR bnc = 0)
    `);
    if (noTagNoBnc[0].count > 0) {
      issues.push(`tag 和 bnc 同时无效的记录: ${noTagNoBnc[0].count} 条（这些本应被过滤）`);
      console.log(`   ⚠️  tag 和 bnc 同时无效: ${noTagNoBnc[0].count} 条`);
    } else {
      console.log('   ✅ 所有记录均有 tag 或 bnc 标记');
    }

    // 4e. 重复单词检查
    const [dupes] = await pool.query(`
      SELECT word, COUNT(*) AS cnt FROM words GROUP BY word HAVING cnt > 1 LIMIT 3
    `);
    if (dupes.length > 0) {
      const names = dupes.map(d => `${d.word}(${d.cnt}次)`).join(', ');
      issues.push(`存在重复单词: ${names}`);
      console.log(`   ⚠️  重复单词: ${names}`);
    } else {
      console.log('   ✅ 无重复单词');
    }

    // 4f. 难度分布
    const [diffDist] = await pool.query(`
      SELECT difficulty, COUNT(*) AS cnt FROM words GROUP BY difficulty ORDER BY difficulty
    `);
    console.log('   难度分布:');
    for (const row of diffDist) {
      const bar = '█'.repeat(Math.max(1, Math.round(row.cnt / Math.max(1, totalCount) * 30)));
      console.log(`     ${row.difficulty}: ${bar} ${row.cnt}`);
    }

    // 4g. 词性覆盖率
    const [posStats] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN pos IS NOT NULL AND pos != '' THEN 1 ELSE 0 END) AS with_pos
      FROM words
    `);
    const posRate = totalCount > 0
      ? ((posStats[0].with_pos / posStats[0].total) * 100).toFixed(1)
      : 0;
    console.log(`   ✅ 词性覆盖率: ${posStats[0].with_pos}/${posStats[0].total} (${posRate}%)`);

    // 4h. 检查是否有异常字符
    const [weirdChars] = await pool.query(`
      SELECT COUNT(*) AS count FROM words
      WHERE word REGEXP '[^a-zA-Z0-9 \\-]' AND word NOT REGEXP '^[a-zA-Z]+$'
      LIMIT 1
    `);
    if (weirdChars[0].count > 0) {
      console.log(`   📝 含非纯字母单词: ${weirdChars[0].count} 条（如带连字符的复合词，属正常）`);
    }

  } finally {
    await closeDatabase();
  }

  // ===============================================
  // 5. 最终结论
  // ===============================================
  console.log('');
  console.log('═'.repeat(50));

  if (issues.length === 0) {
    console.log('✅ 导入正常');
    console.log(`   words 表共 ${totalCount.toLocaleString()} 条记录，数据质量良好`);
    console.log('');
    console.log('🔜 可以启动服务器开始使用:');
    console.log('   cd backend && node server.js');
  } else {
    console.log(`⚠️  发现问题 (${issues.length} 项):`);
    issues.forEach((issue, i) => {
      console.log(`   ${i + 1}. ${issue}`);
    });
    console.log('');
    console.log('💡 建议:');
    if (issues.some(i => i.includes('为空') || i.includes('空值'))) {
      console.log('   - 检查源 CSV 文件是否完整');
    }
    if (issues.some(i => i.includes('重复'))) {
      console.log('   - 运行转换脚本重新处理: node scripts/convertEcdict.js');
    }
    if (issues.some(i => i.includes('未执行'))) {
      console.log('   - 将 ecdict.csv 放到 backend/ 目录后重启服务器');
    }
  }

  process.exit(issues.length > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('❌ 验证脚本执行失败:', err.message);
  process.exit(1);
});
