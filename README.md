# COBOL Tools for NetCOBOL

[![Visual Studio Marketplace](https://img.shields.io/visual-studio-marketplace/v/zhuuchaofan.cobol-tools-for-netcobol?label=Marketplace)](https://marketplace.visualstudio.com/items?itemName=zhuuchaofan.cobol-tools-for-netcobol)
[![Open VSX](https://img.shields.io/open-vsx/v/zhuuchaofan/cobol-tools-for-netcobol?label=Open%20VSX)](https://open-vsx.org/extension/zhuuchaofan/cobol-tools-for-netcobol)
[![CI](https://github.com/zhuuchaofan/cobol-tools-for-netcobol/actions/workflows/ci.yml/badge.svg)](https://github.com/zhuuchaofan/cobol-tools-for-netcobol/actions/workflows/ci.yml)

日本語 | [English](docs/README.en.md) | [简体中文](docs/README.zh-CN.md)

**NetCOBOL の固定形式ソース**を VS Code で快適に読み書きするための拡張機能です。
桁位置は **Shift_JIS のバイト数（全角＝2桁）** で数えるので、日本語を含む行でもコンパイラと同じ桁でチェックできます。

> 本拡張機能は**非公式**です。富士通株式会社とは関係ありません。NetCOBOL は富士通株式会社の登録商標です。

![構文ハイライト](images/highlight.png)

## 主な機能

### 構文ハイライト
- 一連番号領域（1〜6桁）・プログラム識別領域（73〜80桁）を薄く表示（バイト基準なので全角があってもずれない）
- 標識領域（7桁目）：`*` `/` 注記行、`D` デバッグ行、`-` 継続行
- 部・節・段落（日本語の段落名も可）、`PERFORM` / `GO TO` の飛び先
- レベル番号・データ名（日本語可）・`PIC` 文字列・`COMP-3` などの用途
- NetCOBOL の定数：`NC"…"` `N"…"` `NX"…"` `X"…"` `B"…"`
- `@OPTIONS`、`*>` 浮動注記、`EXEC SQL … END-EXEC`（ホスト変数 `:WS-X`）
- `SYSERR` / `CONSOLE` / `ARGUMENT-VALUE` / `ENVIRONMENT-VALUE` などの機能名、特殊レジスタ、`FUNCTION xxx`

### 書式チェック（問題パネル）

![書式チェック](images/diagnostics.png)

| コード | 重大度 | 内容 |
|---|---|---|
| NC001 | エラー | 標識領域（7桁目）の文字が無効（空白 `*` `/` `-` `D` のみ可） |
| NC002 | エラー | 全角文字が 6/7・7/8・72/73 桁の境界にまたがっている（72/73 は注記の中では対象外） |
| NC003 | 警告 | 72桁目を越えて記述が続いている（注記の中では対象外） |
| NC004 | 警告 | 1行が80桁を超えている（上限は設定可） |
| NC005 | 警告 | 部・節・段落の見出し、FD、01/77 が A領域（8〜11桁）から始まっていない |
| NC006 | 警告 | 手続き部の文（MOVE、IF など）が A領域から始まっている |
| NC007 | エラー | 文字定数が72桁目までに閉じておらず、次の行も継続行ではない |
| NC008 | エラー | 継続行が引用符で文字定数を再開していない |
| NC009 | 警告 | 定数・注記以外の全角スペース |
| NC010 | 警告 | タブ文字（桁位置がずれる可能性） |
| NC011 | 警告 | 継続行の A領域が空白でない |
| NC012 | 情報 | 一連番号が空白（連続する行はまとめて1件） |
| NC013 | 情報 | 一連番号が6桁の数字でない |
| NC014 | 情報 | 一連番号が前の行より大きくない |

メッセージは VS Code の表示言語（日本語／English／简体中文）に合わせて表示されます。

### 一連番号の振り直し
- 右クリックメニュー、またはコマンドパレットの「NetCOBOL: 一連番号（1〜6桁）の振り直し」
- 選択なし：ファイル全体を `000010` から 10 刻みで振り直し（空行にも番号を付与。ファイル末尾の改行後の空行は対象外）
- 選択あり：選択した行だけを、すぐ上の有効な番号の続きから振り直し
- NC012〜NC014 の電球（`Ctrl+.`）からも実行可能
- 開始番号・増分は `netcobol.sequence.start` / `netcobol.sequence.step` で変更可。`Ctrl+Z` 1回で元に戻せます

### その他
- `Ctrl+/`（Mac は `Cmd+/`）：7桁目の `*` で注記行を切り替え
- NetCOBOL ファイルの既定値：`files.encoding = shiftjis`、ルーラー `6, 7, 11, 72`、行末空白の自動削除オフ

## インストール

拡張機能ビューで **「COBOL Tools for NetCOBOL」** を検索してインストールします。
VSCodium・Cursor などは [Open VSX](https://open-vsx.org/extension/zhuuchaofan/cobol-tools-for-netcobol) から、オフライン環境は [Releases](https://github.com/zhuuchaofan/cobol-tools-for-netcobol/releases) の `.vsix` を「VSIX からのインストール…」で入れてください。

### チームで使う
プロジェクトのリポジトリに `.vscode/extensions.json` を置くと、開いたメンバーにインストールが勧められます。

```json
{
  "recommendations": ["zhuuchaofan.cobol-tools-for-netcobol"]
}
```

### 他の COBOL 拡張機能と一緒に使う場合
同じ拡張子を別の拡張機能が使っていると、そちらで開かれることがあります。右下の言語モードを **NetCOBOL** に切り替えるか、`settings.json` で指定してください。

```json
"files.associations": { "*.cob": "netcobol", "*.cbl": "netcobol", "*.cpy": "netcobol" }
```

対象の拡張子：`.cob` `.cbl` `.cobol` `.cpy` `.pco`

## 設定

| 設定 | 既定値 | 説明 |
|---|---|---|
| `netcobol.columnCounting` | `shiftjis` | 桁の数え方：`shiftjis` / `utf8` / `character` |
| `netcobol.diagnostics.enabled` | `true` | 書式チェックを有効にする |
| `netcobol.diagnostics.maxLineLength` | `80` | 1行の上限桁数（0 で無効） |
| `netcobol.diagnostics.disabledRules` | `[]` | 無効にするルール（例：`["NC010", "NC012"]`） |
| `netcobol.dimFixedAreas` | `true` | 一連番号領域・プログラム識別領域を薄く表示 |
| `netcobol.sequence.start` | `10` | 一連番号の開始番号 |
| `netcobol.sequence.step` | `10` | 一連番号の増分 |

UTF-8 のソースでは `files.encoding` を `utf8`、`netcobol.columnCounting` を `utf8` にしてください。

## 制限事項
- 固定形式のみ対応です。可変形式・自由形式のソースでは桁チェックが合いません（チェックは無効にできます）
- Shift_JIS の桁数は「ASCII・半角カナ＝1、それ以外＝2」で計算しています
- B領域から始まる段落名はチェックしません（複数行にわたる文と区別できないため）

## フィードバック・貢献
不具合報告や要望は [Issues](https://github.com/zhuuchaofan/cobol-tools-for-netcobol/issues) へ（日本語・English・中文 OK）。
**お客様のソースコードや設計書は貼らないでください。** 再現には最小限のサンプルを作成してください。
開発方法は [CONTRIBUTING.md](CONTRIBUTING.md) を参照してください。

## ライセンス
[MIT](LICENSE)
