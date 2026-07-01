/**
 * 单词发音播放器
 * 
 * 功能：本地音频优先播放，失败时降级使用 Web Speech API
 * 
 * 使用示例：
 *   import { playPronunciation, stopPronunciation } from '@/utils/audioPlayer';
 *   
 *   // 播放单词发音
 *   playPronunciation('apple');
 *   
 *   // 停止播放
 *   stopPronunciation();
 */

// 当前播放的音频对象
let currentAudio = null;

// 是否正在使用 Web Speech API
let isUsingSpeechSynthesis = false;

/**
 * 播放单词发音
 * @param {string} word - 要播放的单词
 * @returns {Promise<void>} - 播放完成的 Promise
 */
export function playPronunciation(word) {
  return new Promise((resolve) => {
    // 先停止当前播放
    stopPronunciation();

    if (!word || typeof word !== 'string') {
      console.warn('[audioPlayer] 无效的单词');
      resolve();
      return;
    }

    const normalizedWord = word.toLowerCase().trim();
    const audioPath = `/audio/${normalizedWord}.mp3`;

    // 创建 Audio 对象尝试播放本地文件
    const audio = new Audio(audioPath);
    currentAudio = audio;

    // 播放成功
    audio.oncanplaythrough = () => {
      audio.play()
        .then(() => {
          console.log(`[audioPlayer] 播放本地音频: ${normalizedWord}`);
        })
        .catch(err => {
          console.warn('[audioPlayer] 本地音频播放失败，降级使用 TTS:', err.message);
          fallbackToSpeechSynthesis(normalizedWord, resolve);
          return;
        });
    };

    // 播放结束
    audio.onended = () => {
      currentAudio = null;
      resolve();
    };

    // 加载失败（文件不存在）
    audio.onerror = () => {
      console.log(`[audioPlayer] 本地音频不存在: ${audioPath}，降级使用 TTS`);
      fallbackToSpeechSynthesis(normalizedWord, resolve);
    };

    // 开始加载
    audio.load();
  });
}

/**
 * 播放例句发音
 * @param {string} sentence - 要播放的句子
 * @returns {Promise<void>} - 播放完成的 Promise
 */
export function playSentence(sentence) {
  return new Promise((resolve) => {
    // 先停止当前播放
    stopPronunciation();

    if (!sentence || typeof sentence !== 'string') {
      console.warn('[audioPlayer] 无效的句子');
      resolve();
      return;
    }

    const trimmedSentence = sentence.trim();
    
    // 例句直接使用 Web Speech API（句子较长，本地音频不现实）
    // 检查浏览器支持
    if (!('speechSynthesis' in window)) {
      console.warn('[audioPlayer] 浏览器不支持 Web Speech API');
      resolve();
      return;
    }

    // 停止之前的语音
    window.speechSynthesis.cancel();
    isUsingSpeechSynthesis = true;

    const utterance = new SpeechSynthesisUtterance(trimmedSentence);
    
    // 设置英语发音
    utterance.lang = 'en-US';
    utterance.rate = 0.85;  // 句子稍慢更清晰
    utterance.pitch = 1;
    utterance.volume = 1;

    // 尝试选择英语发音引擎
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith('en'));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    // 播放结束
    utterance.onend = () => {
      isUsingSpeechSynthesis = false;
      resolve();
    };

    // 播放失败
    utterance.onerror = (event) => {
      isUsingSpeechSynthesis = false;
      console.warn('[audioPlayer] 例句 TTS 播放失败:', event.error);
      resolve();
    };

    // 开始播放
    window.speechSynthesis.speak(utterance);
    console.log(`[audioPlayer] TTS 朗读例句: ${trimmedSentence}`);
  });
}

/**
 * 降级使用 Web Speech API 朗读
 * @param {string} word - 要朗读的单词
 * @param {function} resolve - Promise 的 resolve 函数
 */
function fallbackToSpeechSynthesis(word, resolve) {
  // 检查浏览器支持
  if (!('speechSynthesis' in window)) {
    console.warn('[audioPlayer] 浏览器不支持 Web Speech API');
    resolve();
    return;
  }

  // 停止之前的语音
  window.speechSynthesis.cancel();
  isUsingSpeechSynthesis = true;

  const utterance = new SpeechSynthesisUtterance(word);
  
  // 设置英语发音
  utterance.lang = 'en-US';
  utterance.rate = 0.8;  // 稍慢一点，更清晰
  utterance.pitch = 1;

  // 尝试选择英语发音引擎
  const voices = window.speechSynthesis.getVoices();
  const englishVoice = voices.find(v => v.lang.startsWith('en'));
  if (englishVoice) {
    utterance.voice = englishVoice;
  }

  // 播放结束
  utterance.onend = () => {
    isUsingSpeechSynthesis = false;
    resolve();
  };

  // 播放失败
  utterance.onerror = (event) => {
    isUsingSpeechSynthesis = false;
    console.warn('[audioPlayer] TTS 播放失败:', event.error);
    resolve();
  };

  // 开始播放
  window.speechSynthesis.speak(utterance);
  console.log(`[audioPlayer] TTS 朗读: ${word}`);
}

/**
 * 停止当前播放
 */
export function stopPronunciation() {
  // 停止音频
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }

  // 停止 TTS
  if (isUsingSpeechSynthesis && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    isUsingSpeechSynthesis = false;
  }
}

/**
 * 检查是否正在播放
 * @returns {boolean}
 */
export function isPlaying() {
  return currentAudio !== null || isUsingSpeechSynthesis;
}

/**
 * 预加载音频文件
 * @param {string[]} words - 要预加载的单词列表
 */
export function preloadAudio(words) {
  if (!Array.isArray(words)) return;

  words.forEach(word => {
    if (word && typeof word === 'string') {
      const normalizedWord = word.toLowerCase().trim();
      const audio = new Audio(`/audio/${normalizedWord}.mp3`);
      audio.preload = 'auto';
      audio.load();
    }
  });
}

export default {
  playPronunciation,
  playSentence,
  stopPronunciation,
  isPlaying,
  preloadAudio
};
