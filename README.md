# Panic Player Web

[English](README_en.md)

<p align="center">
  <img src="https://github.com/user-attachments/assets/fbe3ff29-31d5-474c-b982-f7ac94044503" alt="Panic Player WebでPANアニメーションを再生している画面" width="100%">
</p>

久しぶりにX68000の **PANIC** が見たくなり、PANIC Playerを作っていたら、いつの間にかWebアプリになりました。  
X68000全体のエミュレータを目指すものではなく、あくまで **PANICを気軽に楽しめる環境**です :)

**▶ [Panic Player Web — ブラウザ版](https://layer812.github.io/PanicPlayerWeb/)**（GitHub Pages 公開準備中）

皆さんの手元にある `.PAN` ファイルを、ブラウザで選択して再生できます。**ローカルで選択したPANは外部のサーバーにアップロードされず、ブラウザ内で処理されます。** アプリ独自のPAN保存機能はありません。なお、ブラウザ自体の通常の一時キャッシュまで保証するものではありません。

サンプルとして **[DENKO1.PAN（デンコちゃん）](pan/DENKO1.PAN)** も置きました。ブラウザのPAN一覧から選んで再生できます。

このWeb版は [X68K Tab](https://github.com/Layer812/X68KTab5) をベースに開発しました。元となったM5Stack Tab5向けの [panicplayer](https://github.com/Layer812/PanicPlayerTab5) もご覧ください。

## 使い方

1. PANICの再生画面で、**PANファイルを選択**するか、フォルダを選択します（ドラッグ＆ドロップも可能です）。
2. **PLAY**で音声付き再生。**PREV / NEXT** は前後のファイルへ切り替えて再生します。
3. **REPEAT**は同じ作品の繰り返し、**FOLDER AUTO**は一覧を順に再生して最後から先頭へ戻ります。
4. 詳しい実行情報が必要な場合だけ、画面下部の「再生診断」を開いてください。

GitHubの `main/pan/` にあるサンプルについては、ファイル名の一覧だけを読み込み、ファイル本体は再生操作時に取得します。任意の外部URLを入力して再生する機能や、PANの共有URLを作る機能はありません。

## ソースコードの使い方

Web版の新規実装には **Musashiによる実68000エミュレーション**とオリジナルの **PANIC.X V1.38** を用いています。

必要なもの：

- Python 3、Node.js 20以降、Emscripten（`emcc`）
- [X68K Tab](https://github.com/Layer812/X68KTab5) の正規ソース一式（Musashi実装と `src/panic_x_bin.c` を含むバージョン）、または同等の正当に入手した原資料

Windowsでの開発用起動例：

```bat
py -3 tools\START_PLAY.py --source "G:\X68KTab5" --pan "G:\MyPAN\example.PAN"
```

**公開状況：** 現在はREADME、権利資料、Web画面HTMLを先行公開しています。FIX38のエミュレータ本体・JavaScript・ビルドスクリプト・テスト一式は公開用パッケージとして整理済みですが、**GitHubへの一括登録は未完了**です。上記起動コマンドはソース一式の登録後に利用できます。また、完成済みのCPU WASMやPANIC.Xはこのリポジトリには含みません。

開発用の `tools/` はビルド・起動に必要です。`tests/` は回帰検証用、`docs/` は開発・参考資料用です。GitHubには残し、GitHub Pagesには公開に必要な実行ファイルだけを配置する予定です。

## 著作権・謝辞

- **Panic Player Webの新規コード**：© 2026 Layer812
- **PANIC / `PANIC.X`**：原作者・著作権者 **永田英哉（pako／ぱこたん）さん**、V1.38改訂 **なしみさん**。原版の文書・条件を優先します
- **Musashi**：© Karl Stenerudおよび貢献者（MIT License）
- **PX68K / WinX68k / xkeropi**: X68000エミュレータの開発・移植・調査に携わった皆様
- **各 `.PAN` 作品**：映像・音楽・データの権利は各制作・権利者に帰属します
- **SHARP X68000**：SHARPおよび各権利者の名称・商標。非公式・非公認の個人プロジェクトです

**PANIC本体の配布許諾と、PANデータの配布許諾は別です。** 詳細・一次資料は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)、[LICENSE_PANIC_X.txt](LICENSE_PANIC_X.txt)、[PANIC_V1.38_NOTICE.txt](PANIC_V1.38_NOTICE.txt) を参照してください。PANICのオリジナル文書は [PanicPlayerTab5のdocs](https://github.com/Layer812/PanicPlayerTab5/tree/main/docs) に保存されています。

本リポジトリのMITライセンスは、**Layer812が権利を持つ新規実装部分にのみ**適用され、第三者のコード・実行形式・各PANには拡張されません。

PANICとX68000の文化を支え、貴重なデータを保存されてきた皆様に感謝します。
