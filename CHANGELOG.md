# Changelog

## 0.4.0
- 予約語・組込み関数の一覧を `src/core/keywords.ts` に整理（COBOL 85 規格＋NetCOBOL の一般的な拡張。文法書との突き合わせは今後）
- 新しいチェック：NC015 定数の中身（X / NX / B / N / NC）、NC016 見出しの終止符、NC017 レベル番号、NC018 予約語の利用者語使用
- `WITH DEBUGGING MODE` がなければ `D` 行を注記行として扱う（斜体・薄色表示）
- `@OPTIONS SRF(VAR / FREE)` と設定 `netcobol.sourceFormat` で可変形式・自由形式に対応
- 擬似テキスト `==…==` のハイライト、既知の組込み関数名のハイライト
- 定義へ移動で修飾（`A OF B`）と `COPY … REPLACING` を考慮

## 0.3.0
- 名称を「COBOL Tools for NetCOBOL」に変更（非公式であることを明記）、Marketplace / Open VSX での公開準備
- アイコン、日本語・英語・中国語の README、CI（Windows / macOS / Linux）と自動リリース
- アウトライン（部・節・段落・FD・データ項目の階層、COPY）、折りたたみ
- 定義へ移動：段落名・節名・データ名・ファイル名（COPY 先の登録集原文も検索）
- COPY 句から登録集原文を開く（`netcobol.copybook.paths` / `netcobol.copybook.extensions`）

## 0.2.0
- 一連番号（1〜6桁）の振り直しコマンド（コマンドパレット・右クリック、選択範囲のみも可）
- 一連番号チェック NC012（空白）/ NC013（6桁数字でない）/ NC014（昇順でない）とクイックフィックス
- 72/73桁にまたがる全角文字・72桁超えを、注記行と `*>` 注記の中では報告しないように変更

## 0.1.0
- 初版：NetCOBOL 固定形式の構文ハイライト、書式チェック NC001–NC011、Shift_JIS 桁計算、7桁目コメント切り替え
