const STOP_WORDS = new Set([
  // English Stopwords
  'the', 'and', 'with', 'from', 'that', 'this', 'have', 'are', 'not', 'you', 'for', 'was',
  'but', 'they', 'all', 'there', 'what', 'about', 'can', 'will', 'just', 'your', 'some', 'out',
  'how', 'then', 'now', 'which', 'their', 'like', 'than', 'because', 'when', 'who', 'has', 'make',
  'more', 'into', 'been', 'well', 'also', 'any', 'could', 'very', 'were', 'would', 'should',
  'upon', 'these', 'those', 'only', 'such', 'even', 'most', 'through', 'where', 'much', 'before',
  'after', 'over', 'between', 'many', 'being', 'under', 'while', 'does', 'did', 'having',
  
  // Japanese Stopwords (Basic Particles and Auxiliary Verbs)
  'は', 'が', 'を', 'に', 'へ', 'と', 'より', 'から', 'で', 'や', 'の', 'も', 'など', 'か',
  'て', 'たり', 'です', 'ます', 'する', 'した', 'ない', 'ある', 'いる', 'こと', 'もの',
  'これ', 'それ', 'あれ', 'どれ', 'この', 'その', 'あの', 'どの', 'ここ', 'そこ', 'あそこ', 'どこ',
  'ため', 'よう', 'そう', 'できる', 'なる', 'という', 'にて', 'および', 'かつ', 'また', 'しかし'
]);

const CJK_RE = /[\u3040-\u30ff\u4e00-\u9faf]/;

export function extractKeywords(text) {
  if (!text) return new Set();
  
  let segmenter;
  try {
    segmenter = new Intl.Segmenter(undefined, { granularity: 'word' });
  } catch (e) {
    // Fallback if environment doesn't support Intl.Segmenter
    return new Set(text.toLowerCase().split(/\s+/).filter(w => w.length >= 3 && !STOP_WORDS.has(w)));
  }

  const tokens = new Set();
  const segments = segmenter.segment(text);
  
  for (const { segment, isWordLike } of segments) {
    if (!isWordLike) continue;
    
    const word = segment.toLowerCase();
    
    // Ignore short alphanumeric words
    if (word.length <= 2 && !CJK_RE.test(word)) continue;
    
    // Ignore single CJK characters (often common verbs/particles not in stoplist)
    if (word.length < 2 && CJK_RE.test(word)) continue;
    
    // Ignore purely numeric or punctuation tokens
    if (/^[\d,.]+$/.test(word)) continue;
    
    // Ignore Hiragana-only tokens to remove grammatical fragments
    if (/^[\u3040-\u309F]+$/.test(word)) continue;
    
    if (!STOP_WORDS.has(word)) {
      tokens.add(word);
    }
  }

  return tokens;
}
