/**
 * Word lists for NetCOBOL, grouped by role.
 *
 * Source: the COBOL 85 standard reserved words, plus NetCOBOL extensions as far as known
 * without the 文法書 at hand. TODO: verify against 付録A 予約語一覧 / 2.7 組込み関数機能
 * of the NetCOBOL COBOL文法書 and adjust.
 *
 * Used by scripts/build-grammar.js (highlighting) and by the diagnostics / parser.
 */

// ---------------------------------------------------------------- statements
export const VERBS_CONTROL = [
  'PERFORM', 'IF', 'ELSE', 'EVALUATE', 'WHEN', 'GO', 'GOBACK', 'STOP', 'EXIT', 'CALL',
  'CANCEL', 'CONTINUE', 'ALTER', 'ENTRY', 'INVOKE', 'RAISE', 'RESUME', 'USE'
];

export const VERBS = [
  'ACCEPT', 'ADD', 'CLOSE', 'COMPUTE', 'DELETE', 'DISABLE', 'DISPLAY', 'DIVIDE', 'ENABLE',
  'GENERATE', 'INITIALIZE', 'INITIATE', 'INSPECT', 'MERGE', 'MOVE', 'MULTIPLY', 'OPEN',
  'PURGE', 'READ', 'RECEIVE', 'RELEASE', 'RETURN', 'REWRITE', 'SEARCH', 'SEND', 'SET',
  'SORT', 'START', 'STRING', 'SUBTRACT', 'SUPPRESS', 'TERMINATE', 'UNLOCK', 'UNSTRING',
  'WRITE', 'COPY', 'REPLACE'
];

export const SCOPE_TERMINATORS = [
  'END-ACCEPT', 'END-ADD', 'END-CALL', 'END-COMPUTE', 'END-DELETE', 'END-DISPLAY',
  'END-DIVIDE', 'END-EVALUATE', 'END-IF', 'END-INVOKE', 'END-MULTIPLY', 'END-PERFORM',
  'END-READ', 'END-RECEIVE', 'END-RETURN', 'END-REWRITE', 'END-SEARCH', 'END-START',
  'END-STRING', 'END-SUBTRACT', 'END-UNSTRING', 'END-WRITE', 'END-EXEC'
];

// ---------------------------------------------------------------- structure / headers
export const STRUCTURE = [
  'IDENTIFICATION', 'ID', 'ENVIRONMENT', 'DATA', 'PROCEDURE', 'DIVISION', 'SECTION',
  'PROGRAM-ID', 'AUTHOR', 'INSTALLATION', 'DATE-WRITTEN', 'DATE-COMPILED', 'SECURITY',
  'CONFIGURATION', 'SOURCE-COMPUTER', 'OBJECT-COMPUTER', 'SPECIAL-NAMES', 'REPOSITORY',
  'INPUT-OUTPUT', 'FILE-CONTROL', 'I-O-CONTROL', 'FILE', 'WORKING-STORAGE',
  'LOCAL-STORAGE', 'LINKAGE', 'COMMUNICATION', 'REPORT', 'SCREEN', 'DECLARATIVES',
  'END', 'PROGRAM', 'CLASS-ID', 'METHOD-ID', 'FACTORY', 'OBJECT', 'METHOD', 'CLASS',
  'INHERITS', 'FD', 'SD', 'RD', 'CD'
];

// ---------------------------------------------------------------- data description clauses
export const CLAUSES = [
  'PIC', 'PICTURE', 'VALUE', 'VALUES', 'REDEFINES', 'RENAMES', 'OCCURS', 'DEPENDING',
  'INDEXED', 'KEY', 'ASCENDING', 'DESCENDING', 'USAGE', 'SIGN', 'LEADING', 'TRAILING',
  'SEPARATE', 'CHARACTER', 'SYNC', 'SYNCHRONIZED', 'JUST', 'JUSTIFIED', 'BLANK',
  'EXTERNAL', 'GLOBAL', 'FILLER', 'TYPEDEF', 'TYPE', 'BASED', 'CONSTANT', 'BLOCK',
  'CONTAINS', 'RECORD', 'RECORDS', 'LABEL', 'STANDARD', 'OMITTED', 'CODE-SET', 'LINAGE',
  'FOOTING', 'TOP', 'BOTTOM', 'CHARACTERS'
];

export const USAGES = [
  'BINARY', 'COMP', 'COMP-1', 'COMP-2', 'COMP-3', 'COMP-4', 'COMP-5', 'COMPUTATIONAL',
  'COMPUTATIONAL-1', 'COMPUTATIONAL-2', 'COMPUTATIONAL-3', 'COMPUTATIONAL-4',
  'COMPUTATIONAL-5', 'PACKED-DECIMAL', 'DISPLAY-1', 'NATIONAL', 'INDEX', 'POINTER',
  'PROGRAM-POINTER', 'REFERENCE', 'FLOAT-SHORT', 'FLOAT-LONG', 'FLOAT-EXTENDED'
];

// ---------------------------------------------------------------- environment / files
export const ENVIRONMENT = [
  'SELECT', 'ASSIGN', 'OPTIONAL', 'ORGANIZATION', 'SEQUENTIAL', 'LINE', 'RELATIVE',
  'ACCESS', 'MODE', 'RANDOM', 'DYNAMIC', 'ALTERNATE', 'DUPLICATES', 'STATUS', 'LOCK',
  'SHARING', 'RESERVE', 'AREA', 'AREAS', 'PADDING', 'SAME', 'RERUN', 'MULTIPLE',
  'CURRENCY', 'DECIMAL-POINT', 'COMMA', 'ALPHABET', 'SYMBOLIC', 'CLASS', 'CRT', 'CURSOR',
  'COLLATING', 'SEQUENCE', 'NATIVE', 'STANDARD-1', 'STANDARD-2', 'MEMORY', 'SIZE',
  'WORDS', 'MODULES', 'SEGMENT-LIMIT', 'COMMON', 'INITIAL', 'RECURSIVE', 'DEBUGGING',
  'PRINTING'
];

// ---------------------------------------------------------------- other phrase words
export const PHRASES = [
  'TO', 'FROM', 'BY', 'INTO', 'GIVING', 'USING', 'RETURNING', 'REMAINDER', 'ROUNDED',
  'ON', 'OFF', 'ERROR', 'OVERFLOW', 'EXCEPTION', 'INVALID', 'AT', 'EOP', 'END-OF-PAGE',
  'NO', 'ADVANCING', 'UPON', 'OF', 'IN', 'ALL', 'INPUT', 'OUTPUT', 'I-O', 'EXTEND',
  'REVERSED', 'REWIND', 'REPLACING', 'TALLYING', 'CONVERTING', 'FOR', 'FIRST', 'LAST',
  'DELIMITED', 'DELIMITER', 'COUNT', 'CORRESPONDING', 'CORR', 'BEFORE', 'AFTER', 'PAGE',
  'LINES', 'CONTENT', 'AS', 'ANY', 'REMOVAL', 'UNIT', 'REEL', 'ORDER', 'THEN', 'OTHER',
  'ALSO', 'UNTIL', 'VARYING', 'THRU', 'THROUGH', 'TIMES', 'TEST', 'WITH', 'NEXT',
  'SENTENCE', 'RUN', 'PROCEED', 'PROCEDURES', 'REFERENCES', 'DOWN', 'UP', 'RESET',
  'POSITION', 'TALLY', 'NUMBER', 'PLUS', 'LIMIT', 'LIMITS', 'HEADING', 'DETAIL', 'FINAL',
  'CONTROL', 'CONTROLS', 'SOURCE', 'SUM', 'COLUMN', 'GROUP', 'INDICATE', 'PF', 'PH',
  'RF', 'RH', 'CF', 'CH', 'DE', 'REPORTING', 'REPORTS', 'TABLE', 'TERMINAL', 'QUEUE',
  'SUB-QUEUE-1', 'SUB-QUEUE-2', 'SUB-QUEUE-3', 'MESSAGE', 'SEGMENT', 'TEXT', 'EGI',
  'EMI', 'ESI', 'DESTINATION', 'TAPE', 'CLOCK-UNITS', 'COBOL', 'CODE', 'ENTER', 'EVERY',
  'SORT-MERGE'
];

// ---------------------------------------------------------------- conditions / operators
export const CONDITION_WORDS = [
  'AND', 'OR', 'NOT', 'IS', 'ARE', 'EQUAL', 'GREATER', 'LESS', 'THAN', 'NUMERIC',
  'ALPHABETIC', 'ALPHABETIC-LOWER', 'ALPHABETIC-UPPER', 'POSITIVE', 'NEGATIVE',
  'ALPHANUMERIC', 'ALPHANUMERIC-EDITED', 'NUMERIC-EDITED', 'NATIONAL-EDITED'
];

// ---------------------------------------------------------------- figurative constants
export const FIGURATIVE = [
  'ZERO', 'ZEROS', 'ZEROES', 'SPACE', 'SPACES', 'HIGH-VALUE', 'HIGH-VALUES', 'LOW-VALUE',
  'LOW-VALUES', 'QUOTE', 'QUOTES', 'NULL', 'NULLS', 'TRUE', 'FALSE'
];

// ---------------------------------------------------------------- special registers
export const SPECIAL_REGISTERS = [
  'RETURN-CODE', 'SORT-RETURN', 'LENGTH', 'ADDRESS', 'WHEN-COMPILED', 'LINAGE-COUNTER',
  'LINE-COUNTER', 'PAGE-COUNTER', 'DEBUG-ITEM', 'DEBUG-LINE', 'DEBUG-NAME',
  'DEBUG-CONTENTS', 'DEBUG-SUB-1', 'DEBUG-SUB-2', 'DEBUG-SUB-3', 'PROGRAM-STATUS',
  'SELF', 'SUPER', 'EXCEPTION-OBJECT'
];

/** ACCEPT ... FROM sources (reserved) */
export const ACCEPT_SOURCES = ['DATE', 'DAY', 'DAY-OF-WEEK', 'TIME'];

/** function-names usable in SPECIAL-NAMES / ACCEPT / DISPLAY (not reserved) */
export const SYSTEM_NAMES = [
  'SYSIN', 'SYSOUT', 'SYSERR', 'CONSOLE', 'ARGUMENT-NUMBER', 'ARGUMENT-VALUE',
  'ENVIRONMENT-NAME', 'ENVIRONMENT-VALUE', 'YYYYMMDD', 'YYYYDDD'
];

// ---------------------------------------------------------------- screen section (extension)
export const SCREEN_WORDS = [
  'AUTO', 'AUTO-SKIP', 'BELL', 'BLINK', 'FOREGROUND-COLOR', 'BACKGROUND-COLOR',
  'HIGHLIGHT', 'LOWLIGHT', 'REVERSE-VIDEO', 'UNDERLINE', 'SECURE', 'REQUIRED', 'FULL',
  'COL', 'ERASE', 'EOL', 'EOS', 'PROMPT'
];

// ---------------------------------------------------------------- intrinsic functions
/** FUNCTION names: COBOL 85 amendment set, plus common later additions (to verify). */
export const INTRINSIC_FUNCTIONS = [
  'ABS', 'ACOS', 'ANNUITY', 'ASIN', 'ATAN', 'CHAR', 'COS', 'CURRENT-DATE',
  'DATE-OF-INTEGER', 'DATE-TO-YYYYMMDD', 'DAY-OF-INTEGER', 'DAY-TO-YYYYDDD', 'E',
  'FACTORIAL', 'FRACTION-PART', 'INTEGER', 'INTEGER-OF-DATE', 'INTEGER-OF-DAY',
  'INTEGER-PART', 'LENGTH', 'LOG', 'LOG10', 'LOWER-CASE', 'MAX', 'MEAN', 'MEDIAN',
  'MIDRANGE', 'MIN', 'MOD', 'NUMVAL', 'NUMVAL-C', 'ORD', 'ORD-MAX', 'ORD-MIN', 'PI',
  'PRESENT-VALUE', 'RANDOM', 'RANGE', 'REM', 'REVERSE', 'SIGN', 'SIN', 'SQRT',
  'STANDARD-DEVIATION', 'SUM', 'TAN', 'UPPER-CASE', 'VARIANCE', 'WHEN-COMPILED',
  'YEAR-TO-YYYY', 'NATIONAL-OF', 'DISPLAY-OF', 'TRIM', 'TRIML', 'TRIMR', 'ADDR', 'LENG',
  'STORED-CHAR-LENGTH', 'UCS2-OF', 'UTF8-OF'
];

// ---------------------------------------------------------------- derived sets
const up = (a: readonly string[]) => a.map((w) => w.toUpperCase());

/** every word highlighted as a keyword */
export const ALL_KEYWORDS: ReadonlySet<string> = new Set(
  up([
    ...VERBS_CONTROL, ...VERBS, ...SCOPE_TERMINATORS, ...STRUCTURE, ...CLAUSES, ...USAGES,
    ...ENVIRONMENT, ...PHRASES, ...CONDITION_WORDS, ...FIGURATIVE, ...SPECIAL_REGISTERS,
    ...ACCEPT_SOURCES, ...SCREEN_WORDS, 'FUNCTION', 'EXEC'
  ])
);

/**
 * Words that may not be used as data names or paragraph names. Deliberately limited to
 * long-standing reserved words (COBOL 85 core); extension words are left out so the
 * check does not raise false alarms before the list is verified against the manual.
 */
export const RESERVED_FOR_NAMES: ReadonlySet<string> = new Set(
  up([
    ...VERBS_CONTROL.filter((w) => !['INVOKE', 'RAISE', 'RESUME', 'ENTRY'].includes(w)),
    ...VERBS.filter((w) => w !== 'UNLOCK'), ...SCOPE_TERMINATORS.filter((w) => !['END-INVOKE', 'END-EXEC', 'END-ACCEPT', 'END-DISPLAY'].includes(w)),
    'IDENTIFICATION', 'ENVIRONMENT', 'DATA', 'PROCEDURE', 'DIVISION', 'SECTION', 'FILE',
    'WORKING-STORAGE', 'LINKAGE', 'DECLARATIVES', 'END', 'PROGRAM', 'FILLER', 'PIC',
    'PICTURE', 'VALUE', 'VALUES', 'REDEFINES', 'RENAMES', 'OCCURS', 'USAGE', 'SIGN',
    'INDEX', 'KEY', 'RECORD', 'TO', 'FROM', 'BY', 'INTO', 'GIVING', 'USING', 'OF', 'IN',
    'ALL', 'AND', 'OR', 'NOT', 'IS', 'THAN', 'NUMERIC', 'INPUT', 'OUTPUT', 'I-O', 'TIMES',
    'UNTIL', 'VARYING', 'THRU', 'THROUGH', 'WITH', 'NEXT', 'SENTENCE', 'RUN',
    ...FIGURATIVE.filter((w) => !['NULL', 'NULLS'].includes(w)), ...ACCEPT_SOURCES
  ])
);

export const STATEMENT_START: ReadonlySet<string> = new Set(up([...VERBS_CONTROL, ...VERBS, 'EXEC', 'NEXT']));
