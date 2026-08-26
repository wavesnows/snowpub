// 图文（newspic）标题/描述的字符清洗。
// 官方规则：图片消息仅支持纯文本（除商品等功能标签）；emoji 及生僻符号会被微信拒绝
// （"内容包含不支持的特殊字符"）。官方无明确黑名单，按风险区间检测：
//   - BMP 外 U+10000–U+10FFFF：手机键盘 emoji 主力区间（代理对）
//   - Dingbats U+2700–U+27BF：✅❌❤✈ 等高频 emoji（BMP 内最大漏网区）
//   - U+2B00–U+2BFF：⭐⭕ 等（区段内其余字符极生僻，误杀风险低）
//   - 变体选择符 U+FE00–U+FE0F：仅用于把文字符号切到 emoji 呈现，无独立语义
//   - 私用区 U+E000–U+F8FF：自定义字体/图标字符，微信必然不认
// 保留区：U+2600–26FF 杂项符号（★☆ 是中文写作常用强调符）与箭头/标点——
// 宁可漏杀（微信拒稿时有错误兜底），不误杀文字感强的符号。
const UNSUPPORTED_RE = /[\u{10000}-\u{10FFFF}\u{E000}-\u{F8FF}\u{FE00}-\u{FE0F}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}]/gu

/** 找出文本中图文不支持的高风险字符（去重，保持出现顺序）。 */
export function findUnsupportedChars(text: string): string[] {
  return [...new Set((text || '').match(UNSUPPORTED_RE) || [])]
}

/** 移除文本中图文不支持的高风险字符。 */
export function stripUnsupportedChars(text: string): string {
  return (text || '').replace(UNSUPPORTED_RE, '')
}
