# 搜索功能修复日志

## 修复日期
2026-06-20

## 问题描述
搜索功能无法正常工作，搜索已有的单词（如 "access"）显示"未找到相关单词"。

---

## 问题分析过程

### 阶段一：初步排查

| 步骤 | 操作 | 结果 |
|------|------|------|
| 1 | 直接测试后端 API | ✅ 成功，返回正确结果 |
| 2 | 创建纯 HTML 测试页面 | ✅ 成功，API 调用正常 |
| 3 | 检查前端组件代码 | ✅ 代码逻辑正确 |
| 4 | 添加后端日志记录 | ✅ 发现前端没有发出请求 |

### 阶段二：深入调试

**发现的关键线索：**

1. **后端 API 直接调用正常**
   - `GET http://localhost:3001/api/words/search?q=access&type=english` 返回 `{ results: [...], total: 1 }`
   - 通过 Vite 代理调用也正常

2. **前端页面加载异常**
   - 浏览器访问 `http://localhost:5173/search` 时出现 `net::ERR_ABORTED` 错误
   - 后端日志显示没有收到任何搜索请求

3. **后端进程问题**
   - 发现两个后端进程同时运行：PID 43656 和 PID 112820
   - PID 43656 绑定端口 3001，但未加载最新代码（无日志文件生成）
   - PID 112820 使用 `--watch` 模式，但未绑定端口

### 阶段三：定位根本原因

**关键发现：**

重启后端后，前端开始发出请求，但后端返回 SQL 语法错误：

```
搜索错误: You have an error in your SQL syntax; check the manual that corresponds to your MySQL server version for the right syntax to use near ''20' OFFSET 0' at line 11
```

**根本原因：**
- HTTP 请求的查询参数 `pageSize` 和 `offset` 是字符串类型
- SQL 查询中 `LIMIT '20' OFFSET 0` 使用字符串参数，导致语法错误
- MySQL 的 `LIMIT` 和 `OFFSET` 子句要求整数类型参数

---

## 解决方案

### 修改文件：`backend/routes/words.js`

**问题代码：**
```javascript
const { q, type = 'english', page = 1, pageSize = 20 } = req.query;
const offset = (page - 1) * pageSize;
// ...
params = [keyword, `${keyword}%`, `%${keyword}%`, `%${keyword}%`, pageSize, offset];
```

**修复代码：**
```javascript
const { q, type = 'english', page = 1, pageSize = 20 } = req.query;
const pageNum = parseInt(page) || 1;
const pageSizeNum = parseInt(pageSize) || 20;
const offset = (pageNum - 1) * pageSizeNum;
// ...
params = [keyword, `${keyword}%`, `%${keyword}%`, `%${keyword}%`, pageSizeNum, offset];
```

**修复要点：**
1. 使用 `parseInt()` 将字符串参数转换为整数
2. 添加默认值回退，防止转换失败
3. 更新所有 SQL 查询中的参数引用

---

## 测试验证

| 测试项 | 结果 |
|--------|------|
| 搜索 "access" | ✅ 找到 1 个结果 |
| 搜索 "acc" | ✅ 找到 14 个结果 |
| 搜索 "apple" | ✅ 找到多个结果 |
| 搜索中文 "访问" | ✅ 找到相关结果 |
| 防抖搜索 | ✅ 正常工作 |
| 手动搜索按钮 | ✅ 正常工作 |

---

## 额外改进

### 1. 添加后端日志记录
在 `backend/routes/words.js` 中添加了日志功能，记录：
- 收到的搜索请求参数
- SQL 查询结果数量
- 错误信息

### 2. 前端使用原生 fetch
将 `axios` 替换为原生 `fetch`，简化依赖并提高兼容性。

---

## 经验总结

1. **参数类型转换至关重要**：HTTP 请求参数始终是字符串，使用前必须进行类型转换
2. **日志记录是调试利器**：在关键路径添加日志可以快速定位问题
3. **进程管理需注意**：开发环境中确保只有一个后端进程运行，避免端口冲突和代码不同步
4. **测试覆盖多场景**：不仅测试精确匹配，还要测试模糊匹配和边界条件
