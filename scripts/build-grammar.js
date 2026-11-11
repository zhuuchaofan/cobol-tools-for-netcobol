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
// Word lists live in src/core/keywords.ts (compiled to out/ before this script runs).
const K = require('../out/core/keywords.js');
const CONTROL_TERMINATORS = ['END-IF', 'END-PERFORM', 'END-EVALUATE', 'END-CALL', 'END-INVOKE'];
const CONTROL = [
  ...K.VERBS_CONTROL, ...CONTROL_TERMINATORS, 'THEN', 'ELSE', 'WHEN', 'OTHER', 'UNTIL',
  'VARYING', 'THRU', 'THROUGH', 'TIMES', 'NEXT', 'SENTENCE', 'RUN', 'ALSO', 'TEST', 'WITH',
  'DECLARATIVES'
];
const VERBS = [
  ...K.VERBS.filter((w) => w !== 'COPY'),
  ...K.SCOPE_TERMINATORS.filter((w) => !CONTROL_TERMINATORS.includes(w) && w !== 'END-EXEC')
];
const CLAUSES = [...K.CLAUSES, ...K.USAGES, ...K.SCREEN_WORDS];
const ENVIRONMENT = [...K.ENVIRONMENT, ...K.STRUCTURE];
const OTHER = [...K.PHRASES, ...K.CONDITION_WORDS];
const FIGURATIVE = K.FIGURATIVE;
const SPECIAL = [...K.SPECIAL_REGISTERS, ...K.ACCEPT_SOURCES, ...K.SYSTEM_NAMES];
const FUNCTIONS = K.INTRINSIC_FUNCTIONS;
const ALL_KEYWORDS = [...K.ALL_KEYWORDS, ...K.SYSTEM_NAMES];
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

  // COPY ... REPLACING ==a== BY ==b== / REPLACE ==a== BY ==b==
  'pseudo-text': {
    begin: '==',
    beginCaptures: { 0: { name: 'punctuation.definition.string.begin.netcobol' } },
    end: '==|$',
    endCaptures: { 0: { name: 'punctuation.definition.string.end.netcobol' } },
    name: 'string.other.pseudo-text.netcobol'
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
        match: `${NB}((?i:FUNCTION))(\\s+)((?i:${alt(FUNCTIONS)}))${NA}`,
        captures: {
          1: { name: 'keyword.other.netcobol' },
          3: { name: 'support.function.builtin.netcobol' }
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
      { include: '#pseudo-text' },
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
