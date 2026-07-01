# 单词发音音频文件目录

此目录存放单词发音的 MP3 音频文件。

## 文件命名规则

文件名必须是 **小写单词.mp3**，例如：
- `apple.mp3`
- `access.mp3`
- `abandon.mp3`

## 音频来源推荐

1. **有道词典 API**（免费）
   - URL: `https://dict.youdao.com/dictvoice?audio={word}&type=1`
   - 示例: https://dict.youdao.com/dictvoice?audio=apple&type=1

2. **Cambridge Dictionary**
   - 访问 https://dictionary.cambridge.org/
   - 搜索单词后下载发音音频

3. **Google Translate TTS**
   - URL: `https://translate.google.com/translate_tts?ie=UTF-8&tl=en&client=tw-ob&q={word}`

## 批量下载脚本示例

```javascript
// 使用 Node.js 批量下载音频
const https = require('https');
const fs = require('fs');
const path = require('path');

const words = ['apple', 'banana', 'orange']; // 替换为你的单词列表

words.forEach(word => {
  const url = `https://dict.youdao.com/dictvoice?audio=${word}&type=1`;
  const filePath = path.join(__dirname, `${word.toLowerCase()}.mp3`);
  
  https.get(url, (res) => {
    const file = fs.createWriteStream(filePath);
    res.pipe(file);
    console.log(`Downloaded: ${word}.mp3`);
  });
});
```

## 注意事项

- 如果本地没有对应单词的音频文件，系统会自动降级使用 Web Speech API 进行朗读
- 音频文件大小建议控制在 50KB 以内，以保证加载速度
