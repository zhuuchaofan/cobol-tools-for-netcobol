/**
 * Word lists for NetCOBOL, grouped by role.
 *
 * Verified against the NetCOBOL V10.5 COBOL文法書 (B1WD-1361-06Z0):
 *   - reserved words: 付録A, kept in reserved.ts (the only list that decides NC018)
 *   - intrinsic functions: 2.7 組込み関数機能 (INTRINSIC_FUNCTIONS)
 *   - special registers: 1.2.2.3 (SPECIAL_REGISTERS)
 *   - function-names (機能名): 4.2.3 特殊名段落 (SYSTEM_NAMES)
 * The category lists below only decide how a word is coloured. A few words in them are
 * not reserved in V10.5 (see NOT_RESERVED_IN_V105); they are still coloured because later
 * versions and other dialects use them, but they are never reported as reserved.
 *
 * Used by scripts/build-grammar.js (highlighting) and by the diagnostics / parser.
 */
import { RESERVED_NOT_ON_LINUX, RESERVED_WORDS } from './reserved';

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
  'SELF', 'SUPER', 'EXCEPTION-OBJECT',
  // 1.2.2.3: sort/merge and display-file special registers
  'SORT-STATUS', 'SORT-CORE-SIZE', 'EDIT-MODE', 'EDIT-OPTION', 'EDIT-OPTION2',
  'EDIT-OPTION3', 'EDIT-COLOR', 'EDIT-STATUS', 'EDIT-CURSOR'
];

/** ACCEPT ... FROM sources (reserved) */
export const ACCEPT_SOURCES = ['DATE', 'DAY', 'DAY-OF-WEEK', 'TIME'];

/**
 * function-names (機能名, 4.2.3.1-4.2.3.3) usable in SPECIAL-NAMES / ACCEPT / DISPLAY.
 * They are system names, not reserved words, so programs may also use them as user words.
 * YYYYMMDD / YYYYDDD are later additions (ACCEPT ... FROM DATE YYYYMMDD).
 */
export const SYSTEM_NAMES = [
  'SYSIN', 'SYSOUT', 'SYSERR', 'SYSPUNCH', 'CONSOLE', 'ARGUMENT-NUMBER', 'ARGUMENT-VALUE',
  'ENVIRONMENT-NAME', 'ENVIRONMENT-VALUE', 'YYYYMMDD', 'YYYYDDD',
  'CHANNEL-01', 'CHANNEL-02', 'CHANNEL-03', 'CHANNEL-04', 'CHANNEL-05', 'CHANNEL-06',
  'CHANNEL-07', 'CHANNEL-08', 'CHANNEL-09', 'CHANNEL-10', 'CHANNEL-11', 'CHANNEL-12',
  'STACKER-01', 'STACKER-02',
  'SWITCH-0', 'SWITCH-1', 'SWITCH-2', 'SWITCH-3', 'SWITCH-4', 'SWITCH-5', 'SWITCH-6',
  'SWITCH-7', 'SWITCH-8'
];

/**
 * Words in the colouring lists above that are not reserved words on Linux in V10.5:
 * not in 付録A at all, or (RESUME) reserved only for the .NET exception handling feature.
 */
export const NOT_RESERVED_IN_V105: readonly string[] = [
  'LOCAL-STORAGE', 'PROGRAM-POINTER', 'SHARING', 'RECURSIVE', 'AUTO-SKIP', 'COL', 'RESUME'
];

/** compiler-directing statements that may stand alone on a line (not paragraph names) */
export const LISTING_DIRECTIVES: readonly string[] = ['EJECT', 'SKIP1', 'SKIP2', 'SKIP3', 'TITLE'];

// ---------------------------------------------------------------- screen section (extension)
export const SCREEN_WORDS = [
  'AUTO', 'AUTO-SKIP', 'BELL', 'BLINK', 'FOREGROUND-COLOR', 'BACKGROUND-COLOR',
  'HIGHLIGHT', 'LOWLIGHT', 'REVERSE-VIDEO', 'UNDERLINE', 'SECURE', 'REQUIRED', 'FULL',
  'COL', 'ERASE', 'EOL', 'EOS', 'PROMPT'
];

// ---------------------------------------------------------------- intrinsic functions
/** FUNCTION names listed in 2.7 組込み関数機能 (V10.5): 56 functions. */
export const INTRINSIC_FUNCTIONS = [
  'ACOS', 'ACP-OF', 'ADDR', 'ANNUITY', 'ASIN', 'ATAN', 'CAST-ALPHANUMERIC', 'CHAR', 'COS',
  'CURRENT-DATE', 'DATE-OF-INTEGER', 'DAY-OF-INTEGER', 'DISPLAY-OF', 'ENUM-AND', 'ENUM-NOT',
  'ENUM-OR', 'FACTORIAL', 'INTEGER', 'INTEGER-OF-DATE', 'INTEGER-OF-DAY', 'INTEGER-PART',
  'LENG', 'LENGTH', 'LOG', 'LOG10', 'LOWER-CASE', 'MAX', 'MEAN', 'MEDIAN', 'MIDRANGE', 'MIN',
  'MOD', 'NATIONAL', 'NATIONAL-OF', 'NUMVAL', 'NUMVAL-C', 'ORD', 'ORD-MAX', 'ORD-MIN',
  'PRESENT-VALUE', 'RANDOM', 'RANGE', 'REM', 'REVERSE', 'SIN', 'SQRT', 'STANDARD-DEVIATION',
  'STORED-CHAR-LENGTH', 'SUM', 'TAN', 'UCS2-OF', 'UNICODE-OF', 'UPPER-CASE', 'UTF8-OF',
  'VARIANCE', 'WHEN-COMPILED'
];

/** Functions of COBOL 2002 and later versions: coloured, but not in the V10.5 manual. */
export const INTRINSIC_FUNCTIONS_EXTRA = [
  'ABS', 'DATE-TO-YYYYMMDD', 'DAY-TO-YYYYDDD', 'E', 'FRACTION-PART', 'PI', 'SIGN',
  'YEAR-TO-YYYY', 'TRIM', 'TRIML', 'TRIMR'
];

// ---------------------------------------------------------------- derived sets
const up = (a: readonly string[]) => a.map((w) => w.toUpperCase());

const CATEGORISED: ReadonlySet<string> = new Set(
  up([
    ...VERBS_CONTROL, ...VERBS, ...SCOPE_TERMINATORS, ...STRUCTURE, ...CLAUSES, ...USAGES,
    ...ENVIRONMENT, ...PHRASES, ...CONDITION_WORDS, ...FIGURATIVE, ...SPECIAL_REGISTERS,
    ...ACCEPT_SOURCES, ...SCREEN_WORDS, 'FUNCTION', 'EXEC'
  ])
);

/** reserved words (付録A) that none of the category lists above covers: plain keywords */
export const RESERVED_OTHER: readonly string[] = RESERVED_WORDS.filter((w) => !CATEGORISED.has(w));

/** every word highlighted as a keyword */
export const ALL_KEYWORDS: ReadonlySet<string> = new Set([...CATEGORISED, ...RESERVED_OTHER]);

/**
 * Words that may not be used as data, paragraph, section or file names: the whole of
 * 付録A that is reserved on Linux and the other platforms alike (1.2.2.1 rule 4). The few
 * words that are reserved only on non-Linux platforms are left out to avoid false alarms.
 */
export const RESERVED_FOR_NAMES: ReadonlySet<string> = new Set(RESERVED_WORDS);

/** reserved only on platforms other than Linux; never reported by NC018 */
export const NOT_RESERVED_ON_LINUX: ReadonlySet<string> = new Set(RESERVED_NOT_ON_LINUX);

export const STATEMENT_START: ReadonlySet<string> = new Set(up([...VERBS_CONTROL, ...VERBS, 'EXEC', 'NEXT']));
