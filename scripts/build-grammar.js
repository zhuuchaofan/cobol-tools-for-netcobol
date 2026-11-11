#!/usr/bin/env node
/*
 * Generates syntaxes/netcobol.tmLanguage.json.
 * Keyword lists live here so they stay readable; edit this file, then run
 *   npm run build:grammar
 *
 * Fixed format (NetCOBOL SRF(FIX)):
 *   1-6  sequence area      7 indicator ( * / - D )
 *   8-11 area A             12-72 area B          73-80 identification area
 * The grammar only looks at columns 1-7 by character position. Areas that
 * depend on Shift_JIS byte width (73-80) are dimmed by the extension
 * (decorations), not by this grammar.
 */
'use strict';
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------- helpers
const WC = '[\\p{L}\\p{N}_\\-]'; // COBOL word character (incl. Japanese, hyphen)
const WORD = '[\\p{L}\\p{N}][\\p{L}\\p{N}_\\-]*';
const NB = `(?<!${WC})`; // not preceded by a word char
const NA = `(?!${WC})`; // not followed by a word char

const esc = (s) => s.replace(/[-]/g, '\\-');
const alt = (list) =>
  [...new Set(list.map((w) => w.toUpperCase()))]
    .sort((a, b) => b.length - a.length)
    .map(esc)
    .join('|');
const kw = (list) => `${NB}(?i:${alt(list)})${NA}`;

// ---------------------------------------------------------------- keywords
const CONTROL = [
  'PERFORM', 'END-PERFORM', 'IF', 'THEN', 'ELSE', 'END-IF', 'EVALUATE', 'WHEN',
  'OTHER', 'END-EVALUATE', 'GO', 'GOBACK', 'STOP', 'RUN', 'EXIT', 'CALL',
  'END-CALL', 'CANCEL', 'CONTINUE', 'NEXT', 'SENTENCE', 'UNTIL', 'VARYING',
  'THRU', 'THROUGH', 'TIMES', 'ALTER', 'INVOKE', 'END-INVOKE', 'RAISE',
  'RESUME', 'ENTRY', 'USE', 'DECLARATIVES', 'ALSO', 'TEST', 'WITH'
];

const VERBS = [
  'ACCEPT', 'ADD', 'CLOSE', 'COMPUTE', 'DELETE', 'DISPLAY', 'DIVIDE',
  'GENERATE', 'INITIALIZE', 'INITIATE', 'INSPECT', 'MERGE', 'MOVE', 'MULTIPLY',
  'OPEN', 'READ', 'RELEASE', 'RETURN', 'REWRITE', 'SEARCH', 'SET', 'SORT',
  'START', 'STRING', 'SUBTRACT', 'SUPPRESS', 'TERMINATE', 'UNSTRING', 'WRITE',
  'REPLACE', 'UNLOCK', 'RECEIVE', 'SEND', 'ENABLE', 'DISABLE', 'PURGE',
  'END-ADD', 'END-COMPUTE', 'END-DELETE', 'END-DIVIDE', 'END-MULTIPLY',
  'END-READ', 'END-RETURN', 'END-REWRITE', 'END-SEARCH', 'END-START',
  'END-STRING', 'END-SUBTRACT', 'END-UNSTRING', 'END-WRITE', 'END-ACCEPT',
  'END-DISPLAY', 'END-RECEIVE'
];

// data description clauses / usages
const CLAUSES = [
  'PIC', 'PICTURE', 'VALUE', 'VALUES', 'REDEFINES', 'RENAMES', 'OCCURS',
  'DEPENDING', 'INDEXED', 'KEY', 'ASCENDING', 'DESCENDING', 'USAGE', 'COMP',
  'COMP-1', 'COMP-2', 'COMP-3', 'COMP-4', 'COMP-5', 'COMPUTATIONAL',
  'COMPUTATIONAL-1', 'COMPUTATIONAL-2', 'COMPUTATIONAL-3', 'COMPUTATIONAL-4',
  'COMPUTATIONAL-5', 'BINARY', 'PACKED-DECIMAL', 'DISPLAY-1', 'NATIONAL',
  'INDEX', 'POINTER', 'PROGRAM-POINTER', 'REFERENCE', 'SIGN', 'LEADING',
  'TRAILING', 'SEPARATE', 'CHARACTER', 'SYNC', 'SYNCHRONIZED', 'JUST',
  'JUSTIFIED', 'BLANK', 'EXTERNAL', 'GLOBAL', 'FILLER', 'TYPEDEF', 'TYPE',
  'BASED', 'CONSTANT', 'FLOAT-SHORT', 'FLOAT-LONG', 'FLOAT-EXTENDED',
  'BLOCK', 'CONTAINS', 'RECORD', 'RECORDS', 'RECORDING', 'LABEL', 'STANDARD',
  'OMITTED', 'CODE-SET', 'LINAGE', 'FOOTING', 'TOP', 'BOTTOM',
  // screen section
  'AUTO', 'AUTO-SKIP', 'BELL', 'BLINK', 'FOREGROUND-COLOR', 'BACKGROUND-COLOR',
  'HIGHLIGHT', 'LOWLIGHT', 'REVERSE-VIDEO', 'UNDERLINE', 'SECURE', 'REQUIRED',
  'FULL', 'COLUMN', 'COL', 'ERASE', 'EOL', 'EOS', 'PROMPT'
];

// environment / identification division words
const ENVIRONMENT = [
  'SELECT', 'ASSIGN', 'OPTIONAL', 'ORGANIZATION', 'SEQUENTIAL', 'LINE',
  'RELATIVE', 'ACCESS', 'MODE', 'RANDOM', 'DYNAMIC', 'ALTERNATE', 'DUPLICATES',
  'STATUS', 'FILE', 'LOCK', 'SHARING', 'RESERVE', 'AREA', 'AREAS', 'PADDING',
  'CONFIGURATION', 'SOURCE-COMPUTER', 'OBJECT-COMPUTER', 'SPECIAL-NAMES',
  'INPUT-OUTPUT', 'FILE-CONTROL', 'I-O-CONTROL', 'REPOSITORY', 'PROGRAM-ID',
  'AUTHOR', 'INSTALLATION', 'DATE-WRITTEN', 'DATE-COMPILED', 'SECURITY',
  'CLASS-ID', 'METHOD-ID', 'FACTORY', 'OBJECT', 'CLASS', 'METHOD', 'INHERITS',
  'PROPERTY', 'PROGRAM', 'CURRENCY', 'DECIMAL-POINT', 'COMMA', 'ALPHABET',
  'SYMBOLIC', 'CRT', 'CURSOR', 'COLLATING', 'SEQUENCE', 'NATIVE', 'MEMORY',
  'SIZE', 'SEGMENT-LIMIT', 'COMMON', 'INITIAL', 'RECURSIVE', 'IS'
];

const OTHER = [
  'TO', 'FROM', 'BY', 'INTO', 'GIVING', 'USING', 'RETURNING', 'REMAINDER',
  'ROUNDED', 'ON', 'OFF', 'ERROR', 'OVERFLOW', 'EXCEPTION', 'INVALID', 'AT',
  'END', 'EOP', 'END-OF-PAGE', 'NO', 'ADVANCING', 'UPON', 'OF', 'IN', 'ALL',
  'INPUT', 'OUTPUT', 'I-O', 'EXTEND', 'REVERSED', 'REWIND', 'REPLACING',
  'TALLYING', 'CONVERTING', 'FOR', 'FIRST', 'DELIMITED', 'DELIMITER', 'COUNT',
  'CORRESPONDING', 'CORR', 'NUMERIC', 'ALPHABETIC', 'ALPHABETIC-LOWER',
  'ALPHABETIC-UPPER', 'POSITIVE', 'NEGATIVE', 'BEFORE', 'AFTER', 'PAGE',
  'LINES', 'CONTENT', 'AS', 'ANY', 'REMOVAL', 'UNIT', 'REEL', 'AND', 'OR',
  'NOT', 'ARE', 'EQUAL', 'EQUALS', 'GREATER', 'LESS', 'THAN', 'CHARACTERS',
  'DATA', 'DIVISION', 'SECTION', 'ORDER', 'BOTH'
];

const FIGURATIVE = [
  'ZERO', 'ZEROS', 'ZEROES', 'SPACE', 'SPACES', 'HIGH-VALUE', 'HIGH-VALUES',
  'LOW-VALUE', 'LOW-VALUES', 'QUOTE', 'QUOTES', 'NULL', 'NULLS', 'TRUE', 'FALSE'
];

// special registers + NetCOBOL function-names / ACCEPT sources
const SPECIAL = [
  'RETURN-CODE', 'SORT-RETURN', 'TALLY', 'LENGTH', 'ADDRESS', 'WHEN-COMPILED',
  'LINAGE-COUNTER', 'PROGRAM-STATUS', 'SELF', 'SUPER',
  'SYSIN', 'SYSOUT', 'SYSERR', 'CONSOLE', 'ARGUMENT-NUMBER', 'ARGUMENT-VALUE',
  'ENVIRONMENT-NAME', 'ENVIRONMENT-VALUE', 'DATE', 'DAY', 'DAY-OF-WEEK',
  'TIME', 'YYYYMMDD', 'YYYYDDD'
];

const ALL_KEYWORDS = [
  ...CONTROL, ...VERBS, ...CLAUSES, ...ENVIRONMENT, ...OTHER, ...FIGURATIVE,
  ...SPECIAL, 'COPY', 'FUNCTION', 'EXEC', 'END-EXEC', 'IDENTIFICATION', 'ID',
  'ENVIRONMENT', 'PROCEDURE', 'FD', 'SD', 'RD', 'CD'
];
const NOT_KEYWORD = `(?!(?i:${alt(ALL_KEYWORDS)})${NA})`;

const LEVEL = '(?:0?[1-9]|[1-4][0-9]|66|77|88)';

// ---------------------------------------------------------------- repository
const repository = {
  // whole comment line: '*' or '/' in column 7
  'comment-line': {
    match: '^(.{6})([*/])(.*)$',
    captures: {
      1: { name: 'meta.sequence-area.netcobol' },
      2: { name: 'comment.line.indicator.netcobol punctuation.definition.comment.netcobol' },
      3: { name: 'comment.line.fixed.netcobol' }
    }
  },

  // paragraph header that starts in area A:  "MAIN-PROC."  "1000-初期処理."
  'paragraph-header': {
    match: `^(.{6})([ Dd])( {0,3})${NOT_KEYWORD}(?!${LEVEL}\\s)(${WORD})(?=\\s*\\.(?:\\s|$))`,
    captures: {
      1: { name: 'meta.sequence-area.netcobol' },
      2: { name: 'keyword.other.debug-indicator.netcobol' },
      4: { name: 'entity.name.function.paragraph.netcobol' }
    }
  },

  // level number at the start of a data description entry
  'level-entry': {
    match: `^(.{6})([ Dd])(\\s*)(${LEVEL})(?=\\s|\\.|$)(?:(\\s+)(?:((?i:FILLER))${NA}|${NOT_KEYWORD}(${WORD})))?`,
    captures: {
      1: { name: 'meta.sequence-area.netcobol' },
      2: { name: 'keyword.other.debug-indicator.netcobol' },
      4: { name: 'constant.numeric.level.netcobol' },
      6: { name: 'storage.type.netcobol' },
      7: { name: 'variable.other.definition.netcobol' }
    }
  },

  'indicator-line': {
    patterns: [
      {
        match: '^(.{6})([Dd])',
        captures: {
          1: { name: 'meta.sequence-area.netcobol' },
          2: { name: 'keyword.other.debug-indicator.netcobol' }
        }
      },
      {
        match: '^(.{6})(-)',
        captures: {
          1: { name: 'meta.sequence-area.netcobol' },
          2: { name: 'keyword.operator.continuation.netcobol' }
        }
      }
    ]
  },

  'sequence-area': {
    match: '^.{1,6}',
    name: 'meta.sequence-area.netcobol'
  },

  'floating-comment': {
    match: '\\*>.*$',
    name: 'comment.line.floating.netcobol'
  },

  directive: {
    patterns: [
      {
        begin: '(@(?i:OPTIONS))(?![\\p{L}\\p{N}])',
        beginCaptures: { 1: { name: 'keyword.control.directive.netcobol' } },
        end: '(?=\\*>)|$',
        name: 'meta.preprocessor.options.netcobol',
        patterns: [
          { match: '[A-Za-z][A-Za-z0-9]*', name: 'entity.other.attribute-name.option.netcobol' },
          { match: '\\(([^)]*)\\)', captures: { 1: { name: 'constant.other.option-value.netcobol' } } },
          { match: ',', name: 'punctuation.separator.netcobol' }
        ]
      },
      {
        match: '>>\\s*[A-Za-z][A-Za-z\\-]*',
        name: 'keyword.control.directive.netcobol'
      }
    ]
  },

  'exec-sql': {
    begin: `${NB}((?i:EXEC))(\\s+)((?i:SQL))${NA}`,
    beginCaptures: {
      1: { name: 'keyword.control.exec.netcobol' },
      3: { name: 'keyword.control.exec.netcobol' }
    },
    end: `${NB}((?i:END-EXEC))${NA}`,
    endCaptures: { 1: { name: 'keyword.control.exec.netcobol' } },
    contentName: 'meta.embedded.block.sql.netcobol',
    patterns: [
      { include: '#comment-line' },
      { include: '#indicator-line' },
      { include: '#sequence-area' },
      { match: `(:)(${WORD})`, captures: { 1: { name: 'punctuation.definition.variable.netcobol' }, 2: { name: 'variable.other.host.netcobol' } } },
      { include: 'source.sql' }
    ]
  },

  copy: {
    match: `${NB}((?i:COPY))(\\s+)(?:(${WORD})|("[^"]*"|'[^']*'))(?:(\\s+)((?i:OF|IN))(\\s+)(${WORD}))?`,
    captures: {
      1: { name: 'keyword.control.import.netcobol' },
      3: { name: 'entity.name.type.copybook.netcobol' },
      4: { name: 'string.quoted.copybook.netcobol' },
      6: { name: 'keyword.other.netcobol' },
      8: { name: 'entity.name.namespace.library.netcobol' }
    }
  },

  strings: {
    patterns: [
      {
        // X"..", N"..", NC"..", NX"..", B".."
        begin: `${NB}((?i:NX|NC|N|X|B))(")`,
        beginCaptures: {
          1: { name: 'storage.modifier.literal-prefix.netcobol' },
          2: { name: 'punctuation.definition.string.begin.netcobol' }
        },
        end: '(")(?!")|$',
        endCaptures: { 1: { name: 'punctuation.definition.string.end.netcobol' } },
        name: 'string.quoted.double.prefixed.netcobol',
        patterns: [{ match: '""', name: 'constant.character.escape.netcobol' }]
      },
      {
        begin: `${NB}((?i:NX|NC|N|X|B))(')`,
        beginCaptures: {
          1: { name: 'storage.modifier.literal-prefix.netcobol' },
          2: { name: 'punctuation.definition.string.begin.netcobol' }
        },
        end: "(')(?!')|$",
        endCaptures: { 1: { name: 'punctuation.definition.string.end.netcobol' } },
        name: 'string.quoted.single.prefixed.netcobol',
        patterns: [{ match: "''", name: 'constant.character.escape.netcobol' }]
      },
      {
        begin: '"',
        beginCaptures: { 0: { name: 'punctuation.definition.string.begin.netcobol' } },
        end: '(")(?!")|$',
        endCaptures: { 1: { name: 'punctuation.definition.string.end.netcobol' } },
        name: 'string.quoted.double.netcobol',
        patterns: [{ match: '""', name: 'constant.character.escape.netcobol' }]
      },
      {
        begin: "'",
        beginCaptures: { 0: { name: 'punctuation.definition.string.begin.netcobol' } },
        end: "(')(?!')|$",
        endCaptures: { 1: { name: 'punctuation.definition.string.end.netcobol' } },
        name: 'string.quoted.single.netcobol',
        patterns: [{ match: "''", name: 'constant.character.escape.netcobol' }]
      }
    ]
  },

  picture: {
    match: `${NB}((?i:PICTURE|PIC))(?:(\\s+)((?i:IS)))?(\\s+)(\\S+?)(?=\\.?(?:\\s|$))`,
    captures: {
      1: { name: 'storage.type.picture.netcobol' },
      3: { name: 'storage.type.picture.netcobol' },
      5: { name: 'constant.other.picture.netcobol' }
    }
  },

  headers: {
    patterns: [
      {
        match: `${NB}((?i:IDENTIFICATION|ID|ENVIRONMENT|DATA|PROCEDURE))(\\s+)((?i:DIVISION))${NA}`,
        captures: {
          1: { name: 'keyword.control.division.netcobol' },
          3: { name: 'keyword.control.division.netcobol' }
        }
      },
      {
        match: `${NB}((?i:WORKING-STORAGE|LOCAL-STORAGE|LINKAGE|FILE|SCREEN|REPORT|CONFIGURATION|INPUT-OUTPUT|COMMUNICATION|CONSTANT))(\\s+)((?i:SECTION))${NA}`,
        captures: {
          1: { name: 'keyword.control.section.netcobol' },
          3: { name: 'keyword.control.section.netcobol' }
        }
      },
      {
        match: `${NB}${NOT_KEYWORD}(${WORD})(\\s+)((?i:SECTION))${NA}`,
        captures: {
          1: { name: 'entity.name.type.section.netcobol' },
          3: { name: 'keyword.control.section.netcobol' }
        }
      },
      {
        match: `${NB}((?i:PROGRAM-ID|CLASS-ID|METHOD-ID))(\\s*)(\\.)(\\s*)(${WORD})`,
        captures: {
          1: { name: 'keyword.other.netcobol' },
          3: { name: 'punctuation.terminator.period.netcobol' },
          5: { name: 'entity.name.function.program.netcobol' }
        }
      },
      {
        match: `${NB}((?i:END))(\\s+)((?i:PROGRAM|CLASS|METHOD))(\\s+)(${WORD})`,
        captures: {
          1: { name: 'keyword.other.netcobol' },
          3: { name: 'keyword.other.netcobol' },
          5: { name: 'entity.name.function.program.netcobol' }
        }
      },
      {
        match: `${NB}((?i:FD|SD|RD|CD))(\\s+)(${WORD})`,
        captures: {
          1: { name: 'storage.type.file-description.netcobol' },
          3: { name: 'entity.name.type.file.netcobol' }
        }
      },
      {
        match: `${NB}((?i:SELECT))(\\s+)(?:((?i:OPTIONAL))(\\s+))?(${WORD})`,
        captures: {
          1: { name: 'keyword.other.netcobol' },
          3: { name: 'keyword.other.netcobol' },
          5: { name: 'entity.name.type.file.netcobol' }
        }
      }
    ]
  },

  'procedure-refs': {
    patterns: [
      {
        match: `${NB}((?i:PERFORM))(\\s+)${NOT_KEYWORD}(?!\\d+${NA})(${WORD})(?:(\\s+)((?i:THRU|THROUGH))(\\s+)(${WORD}))?`,
        captures: {
          1: { name: 'keyword.control.netcobol' },
          3: { name: 'entity.name.function.paragraph.netcobol' },
          5: { name: 'keyword.control.netcobol' },
          7: { name: 'entity.name.function.paragraph.netcobol' }
        }
      },
      {
        match: `${NB}((?i:GO))(\\s+)(?:((?i:TO))(\\s+))?${NOT_KEYWORD}(${WORD})`,
        captures: {
          1: { name: 'keyword.control.netcobol' },
          3: { name: 'keyword.control.netcobol' },
          5: { name: 'entity.name.function.paragraph.netcobol' }
        }
      },
      {
        match: `${NB}((?i:FUNCTION))(\\s+)(${WORD})`,
        captures: {
          1: { name: 'keyword.other.netcobol' },
          3: { name: 'support.function.intrinsic.netcobol' }
        }
      }
    ]
  },

  keywords: {
    patterns: [
      { match: kw(CONTROL), name: 'keyword.control.netcobol' },
      { match: kw(VERBS), name: 'keyword.other.verb.netcobol' },
      { match: kw(['COPY']), name: 'keyword.control.import.netcobol' },
      { match: kw(FIGURATIVE), name: 'constant.language.netcobol' },
      { match: kw(SPECIAL), name: 'variable.language.netcobol' },
      { match: kw(CLAUSES), name: 'storage.type.netcobol' },
      { match: kw([...ENVIRONMENT, ...OTHER]), name: 'keyword.other.netcobol' }
    ]
  },

  numbers: {
    match: `${NB}(?:\\d+(?:\\.\\d+)?|\\.\\d+)${NA}`,
    name: 'constant.numeric.netcobol'
  },

  identifier: {
    match: `${NB}${WORD}`,
    name: 'variable.other.netcobol'
  },

  operators: {
    patterns: [
      { match: '\\*\\*|>=|<=|[-+*/=<>&]', name: 'keyword.operator.netcobol' },
      { match: '\\.(?=\\s|$)', name: 'punctuation.terminator.period.netcobol' },
      { match: '[,;]', name: 'punctuation.separator.netcobol' },
      { match: '\\(', name: 'punctuation.section.parens.begin.netcobol' },
      { match: '\\)', name: 'punctuation.section.parens.end.netcobol' }
    ]
  },

  code: {
    patterns: [
      { include: '#floating-comment' },
      { include: '#directive' },
      { include: '#exec-sql' },
      { include: '#strings' },
      { include: '#copy' },
      { include: '#picture' },
      { include: '#headers' },
      { include: '#procedure-refs' },
      { include: '#keywords' },
      { include: '#numbers' },
      { include: '#identifier' },
      { include: '#operators' }
    ]
  }
};

const grammar = {
  $schema: 'https://raw.githubusercontent.com/martinring/tmlanguage/master/tmlanguage.json',
  name: 'NetCOBOL',
  scopeName: 'source.netcobol',
  comment: 'GENERATED by scripts/build-grammar.js - do not edit by hand.',
  patterns: [
    { include: '#comment-line' },
    { include: '#paragraph-header' },
    { include: '#level-entry' },
    { include: '#indicator-line' },
    { include: '#sequence-area' },
    { include: '#code' }
  ],
  repository
};

const out = path.join(__dirname, '..', 'syntaxes', 'netcobol.tmLanguage.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(grammar, null, 2) + '\n');
console.log('wrote', path.relative(process.cwd(), out));
