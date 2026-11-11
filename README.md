# NetCOBOL Support（非官方）

面向 **NetCOBOL 固定形式（SRF(FIX)）** 源码的 VS Code 插件：语法高亮 + 列位置/格式诊断。
列位置按 **Shift_JIS 字节数**计算（全角 = 2 列），与编译器看到的一致。

## 功能

### 语法高亮
- 序号区（1-6 列）/ 标识区（73-80 列）淡化显示 —— 按字节计算，含日文的行也不会错位
- 第 7 列指示区：`*` `/` 注释行、`D` 调试行、`-` 继续行
- DIVISION / SECTION / 段落名（含日文段落名，如 `1000-開始.`）、`PERFORM` / `GO TO` 目标
- 层号、数据名（含日文数据名）、`PIC` 字符串、`COMP-3` 等用法
- NetCOBOL 字面量：`NC"…"` `N"…"` `NX"…"` `X"…"` `B"…"`
- `@OPTIONS` 编译指示、`*>` 浮动注释、`EXEC SQL … END-EXEC`（主变量 `:WS-X`）
- `SYSERR` / `CONSOLE` / `ARGUMENT-VALUE` / `ENVIRONMENT-VALUE` 等功能名、特殊寄存器、`FUNCTION xxx`

### 格式诊断（问题面板）

| 代码 | 级别 | 内容 |
|---|---|---|
| NC001 | 错误 | 第 7 列（指示区）字符非法（只允许 空格 `*` `/` `-` `D`） |
| NC002 | 错误 | 全角字符跨在 6/7、7/8、72/73 列边界上（72/73 在注释行和 `*>` 注释里不检查） |
| NC003 | 警告 | 代码超出第 72 列（73 列以后被编译器忽略；注释不检查） |
| NC004 | 警告 | 行长超过 80 列（可配置） |
| NC005 | 警告 | DIVISION / SECTION / 段落头 / FD / 01 / 77 没有从 A 区（8-11 列）开始 |
| NC006 | 警告 | PROCEDURE DIVISION 中语句（MOVE、IF…）写在了 A 区 |
| NC007 | 错误 | 字符常量到第 72 列仍未闭合，且下一行不是继续行 |
| NC008 | 错误 | 继续行没有以引号重新开始被继续的字符常量 |
| NC009 | 警告 | 常量/注释之外的全角空格 |
| NC010 | 警告 | Tab 字符（列位置可能与编译器不一致） |
| NC011 | 警告 | 继续行的 A 区不是空白 |
| NC012 | 信息 | 序号区（1-6 列）为空；连续的空行合并成一条提示 |
| NC013 | 信息 | 序号区不是 6 位数字 |
| NC014 | 信息 | 序号没有比上一行大 |

NC012–NC014 点灯泡（`Ctrl+.`）可以一键「整个文件的序号区重新编号」。

诊断信息会跟随 VS Code 显示语言，提供 English / 日本語 / 简体中文。

### 序号区重新编号
- 命令面板「NetCOBOL: 序号区（第1-6列）重新编号」，或编辑器右键菜单
- 没有选中内容时：整个文件从 `000010` 开始，每行 +10（空行也编号，变成只有序号的行；文件末尾换行后的空行不动）
- 有选中内容时：只处理选中的行，接着上方最近的有效序号继续编号
- 序号区里原来是全角字符也会按列宽替换，不会让后面的代码错位；全角字符跨 6/7 列的行会跳过并提示
- 起始值、步长可在设置 `netcobol.sequence.start` / `netcobol.sequence.step` 修改
- 一次编辑完成，`Ctrl+Z` 一步撤销

### 其他
- `Ctrl+/`（Mac 为 `Cmd+/`）：在第 7 列切换 `*` 注释
- 默认为 NetCOBOL 文件设置：`files.encoding = shiftjis`、标尺 `6, 7, 11, 72`、关闭行尾空白自动删除

## 安装

VS Code → 扩展视图右上角 `…` → **从 VSIX 安装…** → 选择 `netcobol-support-0.2.0.vsix`。
或命令行：`code --install-extension netcobol-support-0.2.0.vsix`

对应扩展名：`.cob` `.cbl` `.cobol` `.cpy` `.pco`。

> 如果同时装了其他 COBOL 插件，同一扩展名可能被它抢走。右下角语言模式切换为 **NetCOBOL**，
> 或在 `settings.json` 里指定：
> ```json
> "files.associations": { "*.cob": "netcobol", "*.cbl": "netcobol", "*.cpy": "netcobol" }
> ```

## 设置

| 设置项 | 默认值 | 说明 |
|---|---|---|
| `netcobol.columnCounting` | `shiftjis` | 列计算方式：`shiftjis` / `utf8` / `character` |
| `netcobol.diagnostics.enabled` | `true` | 启用诊断 |
| `netcobol.diagnostics.maxLineLength` | `80` | 行长上限（0 为不检查） |
| `netcobol.diagnostics.disabledRules` | `[]` | 关闭指定规则，例如 `["NC010", "NC003"]` |
| `netcobol.dimFixedAreas` | `true` | 淡化序号区与标识区 |
| `netcobol.sequence.start` | `10` | 序号区重新编号的起始值 |
| `netcobol.sequence.step` | `10` | 序号区重新编号的步长 |

UTF-8 源码项目：把 `files.encoding` 改为 `utf8`，并把 `netcobol.columnCounting` 设为 `utf8`。

## 开发

```bash
npm install
npm test          # 生成语法 + 编译 + 单元测试（诊断规则、语法分词）
npm run package   # 测试通过后生成 dist/*.vsix
```

- 关键字列表在 `scripts/build-grammar.js`，修改后 `npm run build:grammar` 重新生成 `syntaxes/netcobol.tmLanguage.json`
- 诊断规则在 `src/core/diagnostics.ts`，序号区检查与重新编号在 `src/core/sequence.ts`（都不依赖 vscode，可单独测试）
- 列计算在 `src/core/columns.ts`
- 文案：`l10n/bundle.l10n.*.json`、`package.nls.*.json`
- 用 VS Code 打开本目录按 `F5` 可启动调试实例

## 限制

- 只针对固定形式；可变形式 / 自由形式源码会被误判列位置（可关闭诊断）
- Shift_JIS 宽度按「ASCII・半角片假名 = 1，其余 = 2」计算，未逐字检查是否为 Shift_JIS 可表示字符
- 段落名写在 B 区这种情况不检查（与跨行语句难以区分，避免误报）

---

## 日本語概要

NetCOBOL 固定形式ソース向けの構文ハイライトと書式チェックです。桁位置は Shift_JIS のバイト数（全角＝2桁）で数えます。
一連番号領域・プログラム識別領域の薄色表示、標識領域（7桁目）・A/B領域・72桁超え・文字定数の継続・全角スペース・タブ・一連番号（空白／数字以外／昇順でない）をチェックします。
右クリックメニューまたはコマンドパレットの「一連番号（1〜6桁）の振り直し」で、000010 から 10 刻みで振り直せます（選択範囲のみも可）。
メッセージは VS Code の表示言語（日本語／中文／English）に従います。

NetCOBOL は富士通株式会社の登録商標です。本拡張機能は非公式です。
