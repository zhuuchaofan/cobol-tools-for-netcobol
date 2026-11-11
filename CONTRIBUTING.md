# 開発への参加 / Contributing

Issue・PR は日本語・English・中文のどれでも歓迎です。

> **お客様のソースコード・設計書・データは絶対に貼らないでください。**
> 不具合の再現には、自分で書いた最小限のサンプルを使ってください。

## 開発環境

- Node.js 20 以上
- VS Code 1.75 以上

```bash
npm install
npm test          # 文法ファイル生成 → TypeScript コンパイル → テスト
npm run package   # テスト後に dist/*.vsix を作成
```

VS Code でこのフォルダーを開いて `F5` を押すと、拡張機能を読み込んだ開発用ウィンドウが `samples/` を開いた状態で起動します。

## 構成

| パス | 内容 |
|---|---|
| `src/core/keywords.ts` | 予約語・組込み関数などの一覧（ハイライトとチェックの共通データ） |
| `scripts/build-grammar.js` | TextMate 文法の生成元。**`syntaxes/*.json` は直接編集せず**、こちらか `keywords.ts` を編集して `npm run compile` |
| `src/core/columns.ts` | 桁計算（Shift_JIS / UTF-8 / 文字数） |
| `src/core/diagnostics.ts` | 書式チェック NC001〜NC011 |
| `src/core/sequence.ts` | 一連番号チェック NC012〜NC014 と振り直し |
| `src/core/structure.ts` | 構造解析（アウトライン・折りたたみ・定義・COPY） |
| `src/core/copybook.ts` | 登録集原文ファイル名の照合ルール |
| `src/features.ts` | アウトライン・折りたたみ・定義へ移動のプロバイダー |
| `src/extension.ts` | VS Code との接続部分（診断・装飾・コマンド） |
| `l10n/`, `package.nls*.json` | メッセージ（英語が原文、`ja` / `zh-cn` が翻訳） |
| `samples/` | Shift_JIS・CRLF のサンプル（テストでも使用） |
| `test/run-tests.js` | テスト（vscode 不要、Node だけで動く） |

`src/core/` は `vscode` を import しないでください。Node だけでテストできる状態を保ちます。

## 変更のルール

- チェックを追加・変更したら `test/run-tests.js` にテストを追加してください
- メッセージを追加したら `l10n/bundle.l10n.ja.json` と `l10n/bundle.l10n.zh-cn.json` の両方に訳を追加してください（キーは英語原文）
- 新しいルールコードは `NC0xx` の連番で、`package.json` の `netcobol.diagnostics.disabledRules` の enum と README の表にも追加してください
- `samples/*.cob` は Shift_JIS・CRLF です。エディタで UTF-8 として保存しないよう注意してください

## リリース（メンテナー向け）

1. `package.json` の `version` と `CHANGELOG.md` を更新して main にマージ
2. `git tag v<version> && git push origin v<version>`
3. GitHub Actions がテスト → GitHub Release → Marketplace / Open VSX へ公開

詳細は [docs/PUBLISHING.md](docs/PUBLISHING.md) を参照してください。
