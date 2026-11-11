# COBOL Tools for NetCOBOL

[日本語](../README.md) | English | [简体中文](README.zh-CN.md)

A VS Code extension for **NetCOBOL fixed-format source**.
Columns are counted in **Shift_JIS bytes (full-width = 2 columns)**, so lines containing Japanese are checked at the same columns the compiler uses.

> This is an **unofficial** extension and is not affiliated with Fujitsu Limited. NetCOBOL is a registered trademark of Fujitsu Limited.

![Syntax highlighting](../images/highlight.png)

## Features

### Syntax highlighting
- Sequence area (columns 1-6) and identification area (73-80) are dimmed, byte-accurately
- Indicator area (column 7): `*` `/` comment lines, `D` debug lines, `-` continuation lines
- Divisions, sections, paragraphs (Japanese names supported), `PERFORM` / `GO TO` targets
- Level numbers, data names (Japanese supported), `PIC` strings, usages such as `COMP-3`
- NetCOBOL literals: `NC"…"` `N"…"` `NX"…"` `X"…"` `B"…"`
- `@OPTIONS`, `*>` floating comments, `EXEC SQL … END-EXEC` (host variables `:WS-X`)
- Function-names such as `SYSERR` / `CONSOLE` / `ARGUMENT-VALUE` / `ENVIRONMENT-VALUE`, special registers, `FUNCTION xxx`

### Format checks (Problems panel)

![Format checks](../images/diagnostics.png)

| Code | Severity | Check |
|---|---|---|
| NC001 | Error | Invalid character in the indicator area (column 7); only space `*` `/` `-` `D` |
| NC002 | Error | Full-width character straddles columns 6/7, 7/8 or 72/73 (72/73 ignored inside comments) |
| NC003 | Warning | Text continues past column 72 (ignored inside comments) |
| NC004 | Warning | Line longer than 80 columns (configurable) |
| NC005 | Warning | Division/section/paragraph header, FD, 01/77 not in area A (columns 8-11) |
| NC006 | Warning | Procedure statement (MOVE, IF, …) starts in area A |
| NC007 | Error | Literal not closed by column 72 and next line is not a continuation line |
| NC008 | Error | Continuation line does not resume the literal with a quote |
| NC009 | Warning | Full-width space outside literals and comments |
| NC010 | Warning | Tab character (columns may not match the compiler) |
| NC011 | Warning | Area A of a continuation line is not blank |
| NC012 | Info | Sequence area is blank (consecutive lines reported once) |
| NC013 | Info | Sequence area is not a 6-digit number |
| NC014 | Info | Sequence number is not greater than the previous one |
| NC015 | Error | Invalid literal content (`X"…"` hex digit pairs, `NX"…"` groups of four, `B"…"` only 0/1, `N"…"`/`NC"…"` full-width only) |
| NC016 | Warning | Division / section header without a separator period |
| NC017 | Warning | Invalid level number (not 01-49, 66, 77, 88) |
| NC018 | Error | Reserved word (appendix A) used as a data, paragraph, section or file name |
| NC019 | Warning | Literal length out of range (character 1-160 bytes, `X` 2-320 digits, `NX` 4-320 digits, `N`/`NC` 1-80 characters, `B` 1-160 digits) |
| NC020 | Warning | Malformed user-defined word (over 30 characters, `-`/`_` at either end, `__`, no letter, a Japanese word without kanji/kana). Mixing Japanese and ASCII is shown as information |

Messages follow the VS Code display language (Japanese / English / Simplified Chinese).

- Debugging lines (`D` in column 7) are treated as comments, shown dimmed and italic, unless `SOURCE-COMPUTER` has `WITH DEBUGGING MODE`
- `@OPTIONS SRF(VAR)` switches to variable format (no column-72 margin); `SRF(FREE)` turns column checks off (or set `netcobol.sourceFormat`)
- Reserved words, intrinsic functions, special registers and function-names follow the **NetCOBOL V10.5 COBOL文法書 (B1WD-1361-06Z0)**. Other versions may add or remove reserved words; if yours differ, turn `NC018` off and tell us
- The full-width check of `N"…"` / `NC"…"` (NC015) assumes the Shift_JIS (non-Unicode) operating mode. For Unicode-mode programs turn it off in `netcobol.diagnostics.disabledRules`

### Renumber sequence area
- Editor context menu, or Command Palette: "NetCOBOL: Renumber Sequence Area (columns 1-6)"
- No selection: the whole file from `000010` in steps of 10 (empty lines are numbered too; the empty line after the final newline is left alone)
- With a selection: only the selected lines, continuing from the nearest valid number above
- Also available as a quick fix (`Ctrl+.`) on NC012-NC014
- Start and step: `netcobol.sequence.start` / `netcobol.sequence.step`. One `Ctrl+Z` undoes it

### Outline, folding, go to definition
- **Outline** (Outline view, `Ctrl+Shift+O`, breadcrumbs): program → divisions → sections → paragraphs; the data division as FD → 01 → 05 … → 88 with `PIC` shown
- **Folding**: divisions, sections, paragraphs, group items, runs of comment lines, `EXEC SQL` blocks
- **Go to definition** (`F12` / `Ctrl+Click`): paragraphs, sections, data names, file names; when not found in the file, the copybooks it `COPY`s are searched too (up to 3 levels). Qualification (`A OF B`) and `COPY … REPLACING ==:PRE:== BY ==WS==` are taken into account
- **COPY**: `F12` / `Ctrl+Click` on the copybook name opens it
  - Search order: the folder of the current file, then `netcobol.copybook.paths`
  - Extensions tried: none, `.cbl`, `.cob`, `.cpy`, `.cobol` (case-insensitive)
  - `COPY name OF lib` also looks in a sub-folder named `lib`

```json
"netcobol.copybook.paths": ["copylib", "${workspaceFolder}/common/copy"]
```

### Other
- `Ctrl+/` (`Cmd+/` on Mac) toggles a `*` comment in column 7
- Defaults for NetCOBOL files: `files.encoding = shiftjis`, rulers at `6, 7, 11, 72`, trailing whitespace trimming off

## Installation

Search for **"COBOL Tools for NetCOBOL"** in the Extensions view.
For VSCodium, Cursor and others use [Open VSX](https://open-vsx.org/extension/zhuuchaofan/cobol-tools-for-netcobol); for offline machines download the `.vsix` from [Releases](https://github.com/zhuuchaofan/cobol-tools-for-netcobol/releases) and use "Install from VSIX…".

### For teams
Add `.vscode/extensions.json` to your project so VS Code recommends the extension to everyone who opens it:

```json
{
  "recommendations": ["zhuuchaofan.cobol-tools-for-netcobol"]
}
```

### Using it alongside other COBOL extensions
Another extension may claim the same file extensions. Switch the language mode (bottom right) to **NetCOBOL**, or set:

```json
"files.associations": { "*.cob": "netcobol", "*.cbl": "netcobol", "*.cpy": "netcobol" }
```

File extensions: `.cob` `.cbl` `.cobol` `.cpy` `.pco`

## Settings

| Setting | Default | Description |
|---|---|---|
| `netcobol.columnCounting` | `shiftjis` | Column counting: `shiftjis` / `utf8` / `character` |
| `netcobol.sourceFormat` | `auto` | Reference format: `auto` (from `@OPTIONS SRF`) / `fixed` / `variable` / `free` |
| `netcobol.diagnostics.enabled` | `true` | Enable format checks |
| `netcobol.diagnostics.maxLineLength` | `80` | Maximum line length (0 = off) |
| `netcobol.diagnostics.disabledRules` | `[]` | Rules to turn off, e.g. `["NC010", "NC012"]` |
| `netcobol.dimFixedAreas` | `true` | Dim sequence and identification areas |
| `netcobol.sequence.start` | `10` | First sequence number |
| `netcobol.sequence.step` | `10` | Sequence number increment |
| `netcobol.copybook.paths` | `[]` | Folders searched for copybooks |
| `netcobol.copybook.extensions` | `["", ".cbl", ".cob", ".cpy", ".cobol"]` | Copybook extensions, tried in order |

For UTF-8 sources set `files.encoding` to `utf8` and `netcobol.columnCounting` to `utf8`.

## Limitations
- Fixed and variable format are supported; free format gets highlighting only (no column checks, no outline)
- Shift_JIS width is "ASCII and half-width katakana = 1, everything else = 2"
- Paragraph names written in area B are not checked (indistinguishable from multi-line statements)
- Outline and go to definition use a simple line-based parser; the `REPLACE` statement and `COPY … JOINING / DISJOINING` are not taken into account

## Feedback and contributing
Report bugs and ideas in [Issues](https://github.com/zhuuchaofan/cobol-tools-for-netcobol/issues) (Japanese, English or Chinese).
**Never paste customer source code or design documents.** Write a minimal sample instead. See [CONTRIBUTING.md](../CONTRIBUTING.md).

## License
[MIT](../LICENSE)
