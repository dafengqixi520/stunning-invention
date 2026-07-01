#!/usr/bin/env node

/**
 * ECDICT CSV 验证 & 转换脚本
 *
 * 功能：
 *   1. 自动检测 CSV 是否有表头行
 *   2. 按列名匹配 → 输出 importEcdict.js 要求的 11 列固定顺序
 *   3. 缺失列自动填空字符串
 *   4. 限制输出行数（默认 10000）
 *   5. 输出 UTF-8 无 BOM
 *
 * 用法：
 *   node scripts/convertEcdict.js <输入文件> [输出文件] [最大行数]
 *
 * 示例：
 *   node scripts/convertEcdict.js downloaded.csv ecdict.csv 5000
 *   node scripts/convertEcdict.js downloaded.csv               # 默认输出 ecdict.csv 限制 10000 条
 *
 * 兼容的输入格式：
 *   - 官方 ECDICT CSV（11 列，无表头）→ 直接放行
 *   - 带表头的 CSV → 按列名匹配后重排
 *   - 列数不同的 CSV → 缺失列填空，多余列丢弃
 */

import { createReadStream, createWriteStream, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify';

// importEcdict.js 要求的 11 列（固定顺序）
const REQUIRED_COLUMNS = [
  'word',        // 第1列
  'phonetic',    // 第2列
  'definition',  // 第3列
  'translation', // 第4列
  'pos',         // 第5列
  'collins',     // 第6列
  'oxford',      // 第7列
  'tag',         // 第8列
  'bnc',         // 第9列
  'frq',         // 第10列
  'exchange',    // 第11列
];

const DEFAULT_MAX_ROWS = 10000;
const DEFAULT_OUTPUT = 'ecdict.csv';

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
ECDICT CSV 验证 & 转换工具

用法:
  node scripts/convertEcdict.js <输入文件> [输出文件] [最大行数]

参数:
  <输入文件>  要转换的原始 CSV 文件路径（必填）
  [输出文件]  输出文件路径（可选，默认: ecdict.csv）
  [最大行数]  最大输出行数（可选，默认: 10000）

示例:
  node scripts/convertEcdict.js ~/Downloads/ecdict.csv.raw
  node scripts/convertEcdict.js input.csv ecdict.csv 5000
  node scripts/convertEcdict.js input.csv ./backend/ecdict.csv 10000

输入文件可以是:
  - 官方 ECDICT CSV（11 列无表头）     → 直接输出
  - 带表头的 CSV（需含 word 列）       → 按列名匹配重排
  - 列顺序不同或列数不同的 CSV         → 自动对齐
`);
    process.exit(0);
  }

  const inputPath = resolve(args[0]);
  const outputPath = resolve(args[1] || DEFAULT_OUTPUT);
  const maxRows = parseInt(args[2]) || DEFAULT_MAX_ROWS;

  // 检查输入文件
  if (!existsSync(inputPath)) {
    console.error(`❌ 输入文件不存在: ${inputPath}`);
    process.exit(1);
  }

  console.log(`📂 输入: ${inputPath}`);
  console.log(`📂 输出: ${outputPath}`);
  console.log(`📊 限制: ${maxRows.toLocaleString()} 行`);
  console.log('');

  // 第一遍：读取首行判断有无表头
  const headerInfo = await detectHeader(inputPath);
  console.log(`🔍 检测结果: ${headerInfo.hasHeader ? '有表头行' : '无表头（官方格式）'}`);

  if (headerInfo.hasHeader) {
    console.log(`   表头列名: ${headerInfo.headers.join(', ')}`);
    // 检查列映射
    const missing = REQUIRED_COLUMNS.filter(c => !headerInfo.columnMap.has(c));
    if (missing.length > 0) {
      console.log(`   ⚠️  缺失列（将填空）: ${missing.join(', ')}`);
    }
  }

  console.log('');

  // 第二遍：流式转换
  const stats = await convert(inputPath, outputPath, headerInfo, maxRows);

  console.log('');
  console.log('✅ 转换完成');
  console.log(`   总输入行数: ${stats.totalRead.toLocaleString()}`);
  console.log(`   总输出行数: ${stats.totalWritten.toLocaleString()}`);
  console.log(`   跳过空行:   ${stats.skipped.toLocaleString()}`);
  console.log('');
  console.log('📋 输出列顺序:');
  REQUIRED_COLUMNS.forEach((col, i) => {
    console.log(`   第${i + 1}列: ${col}`);
  });
  console.log('');
  console.log('🔜 下一步：将输出文件放到 backend/ 目录下，重启服务器即可自动导入。');
}

/**
 * 读取首行判断是否有表头
 */
async function detectHeader(inputPath) {
  return new Promise((resolve, reject) => {
    const parser = createReadStream(inputPath, { encoding: 'utf-8' }).pipe(
      parse({ delimiter: ',', quote: '"', escape: '"', relaxColumnCount: true, skipEmptyLines: true, trim: true, to: 1 })
    );

    parser.once('data', (record) => {
      parser.destroy();

      // 判断逻辑：如果第一行的第一个字段看起来像列名（全小写字母且无标点），则视为表头
      const firstField = (record[0] || '').trim().toLowerCase();
      const looksLikeHeader =
        REQUIRED_COLUMNS.includes(firstField) ||                    // 匹配已知列名
        (firstField === 'word' || firstField === 'vocabulary' || firstField === 'term');

      if (looksLikeHeader) {
        // 构建列名 → 列索引映射
        const columnMap = new Map();
        record.forEach((col, i) => columnMap.set(col.trim().toLowerCase(), i));
        resolve({ hasHeader: true, headers: record.map(c => c.trim()), columnMap });
      } else {
        // 无表头 → 按位置直接映射
        const columnMap = new Map();
        REQUIRED_COLUMNS.forEach((col, i) => columnMap.set(col, i));
        resolve({ hasHeader: false, headers: REQUIRED_COLUMNS, columnMap });
      }
    });

    parser.once('error', reject);
  });
}

/**
 * 流式转换
 */
async function convert(inputPath, outputPath, headerInfo, maxRows) {
  const stats = { totalRead: 0, totalWritten: 0, skipped: 0 };

  const writeStream = createWriteStream(outputPath, { encoding: 'utf-8' });
  // 手动写入 BOM → 这里我们不写 BOM（UTF-8 without BOM）

  const stringifier = stringify({
    delimiter: ',',
    quote: '"',
    quoted: true,        // 所有字段都用引号包裹（更安全）
    header: false,       // 不输出表头
  });

  stringifier.pipe(writeStream);

  return new Promise((resolve, reject) => {
    let isFirstRow = true;

    const parser = createReadStream(inputPath, { encoding: 'utf-8' }).pipe(
      parse({
        delimiter: ',',
        quote: '"',
        escape: '"',
        relaxColumnCount: true,
        skipEmptyLines: true,
        trim: true,
      })
    );

    parser.on('data', (record) => {
      stats.totalRead++;

      // 跳过表头行
      if (headerInfo.hasHeader && isFirstRow) {
        isFirstRow = false;
        return;
      }
      isFirstRow = false;

      // 达到上限
      if (stats.totalWritten >= maxRows) return;

      // 跳过空单词
      const word = extractField(record, headerInfo.columnMap, 'word');
      if (!word) {
        stats.skipped++;
        return;
      }

      // 按固定顺序输出 11 列
      const outputRow = REQUIRED_COLUMNS.map(col =>
        extractField(record, headerInfo.columnMap, col)
      );

      if (stats.totalWritten < maxRows) {
        stringifier.write(outputRow);
        stats.totalWritten++;

        if (stats.totalWritten % 2000 === 0) {
          process.stdout.write(`\r   已转换 ${stats.totalWritten.toLocaleString()} 行...`);
        }
      }
    });

    parser.on('end', () => {
      stringifier.end();
    });

    parser.on('error', reject);
    stringifier.on('finish', () => resolve(stats));
    writeStream.on('error', reject);
  });
}

/**
 * 从 CSV 行中按列名提取字段值
 */
function extractField(record, columnMap, columnName) {
  const idx = columnMap.get(columnName);
  if (idx === undefined) return '';          // 列不存在 → 空字符串
  const val = (record[idx] || '').trim();
  return val;
}

main().catch(err => {
  console.error('❌ 转换失败:', err.message);
  process.exit(1);
});
