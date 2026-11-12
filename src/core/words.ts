/** COBOL user-defined word characters, including Japanese (NetCOBOL allows 日本語利用者語). */
const RANGES = 'A-Za-z0-9\\u3040-\\u30FF\\u3400-\\u9FFF\\uF900-\\uFAFF\\uFF10-\\uFF19\\uFF21-\\uFF3A\\uFF41-\\uFF5A\\uFF66-\\uFF9F';

/** first character of a word */
export const WORD_START = `[${RANGES}]`;
/** any character inside a word (adds _ and hyphens, incl. full-width hyphen-minus) */
export const WORD_PART = `[${RANGES}_\\-\\uFF0D]`;
export const WORD = `${WORD_START}${WORD_PART}*`;

export const WORD_CHAR_RE = new RegExp(WORD_PART);
/** for editor word lookup (no global flag) */
export const WORD_RE = new RegExp(WORD);
