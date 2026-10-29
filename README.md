# Panic Player Web

[English](README_en.md)

<p align="center">
  <img src="https://github.com/user-attachments/assets/3d593001-1acd-4781-b464-5166390b376e" alt="Panic Player WebでPANアニメーションを再生している画面" width="100%">
</p>

久しぶりにX68000の **PANIC** が見たくなり、PANIC Playerを作っていたら、いつの間にかWebアプリになりました。  
X68000全体のエミュレータを目指すものではなく、あくまで **PANICを気軽に楽しめる環境**です :)

**▶ [Panic Player Web — ブラウザ版](https://layer812.github.io/PanicPlayerWeb/)**

皆さんの手元にある `.PAN` ファイルを、ブラウザで選択して再生できます。**ローカルで選択したPANは外部のサーバーにアップロードされず、ブラウザ内で処理されます。** アプリ独自のPAN保存機能はありません。なお、ブラウザ自体の通常の一時キャッシュまで保証するものではありません。

サンプルとして **[DENKO1.PAN（デンコちゃん）](pan/DENKO1.PAN)** も置きました。ブラウザのPAN一覧から選んで再生できます。

このWeb版は [X68K Tab](https://github.com/Layer812/X68KTab5) をベースに開発しました。元となったM5Stack Tab5向けの [panicplayer](https://github.com/Layer812/PanicPlayerTab5) もご覧ください。

## 使い方

1. PANICの再生画面で、**PANファイルを選択**するか、フォルダを選択します（ドラッグ＆ドロップも可能です）。
2. **PLAY**で音声付き再生。**PREV / NEXT** は前後のファイルへ切り替えて再生します。
3. **REPEAT**は同じ作品の繰り返し、**FOLDER AUTO**は一覧を順に再生して最後から先頭へ戻ります。
   再生中に**スペースキー**を押すと、PANIC.XへSPACE入力を渡します。SPACE待ちのある作品では次の場面へ進みます。
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


## GitHub Pages のPAN指定URL

`https://layer812.github.io/PanicPlayerWeb/?pan=denkopcm`

`?pan=英数字` を指定すると、固定の公開リポジトリ `Layer812/PanicPlayerWeb/pan/` から
対応する `.pan` / `.PAN` を検証して**自動再生**します。PAN名以外の任意URLやパスは受け付けません。
一般のURL（`?pan` なし）はこれまでどおりPLAY操作で開始します。

ブラウザの音声自動再生ポリシーによって、映像は始まっても音が制限される場合があります。
その場合は**再生画面を1回クリック**すると音声が有効になり、**PANの冒頭から音声付きで再起動**します。途中まで進んだ映像と捨てられた音声を無理に合成しません。音声ONボタンはありません。

## Z-MUSIC v2.08 / YM2151 FM（2026-10-29公開）

原版 `PANIC.X` と実Musashi 68000を維持したまま、原版 **Z-MUSIC SYSTEM v2.08** の常駐、`TRAP #3`、実YM2151（OPM）FM音声を統合しました。`denkozm.pan` での映像と音声の同期をWindowsブラウザで確認済みです。X68000全体のエミュレータではなく、PANIC専用Webプレイヤーのままです。

- `denkozm.pan`：原版Z-MUSIC 2.08とYM2151のFM演奏に対応
- `denkofm.pan`：直接YM2151 FM音源再生に対応
- `denkopcm.pan`：ADPCM実データの再生に対応

音声を鳴らすには通常のブラウザ音声許可に従い、**PLAY**を押してください。共有URLからの自動再生では、ブラウザの自動再生制限により最初にクリックが必要な場合があります。

FMの音声合成には[Aaron Giles氏のymfm](https://github.com/aaronsgiles/ymfm)（BSD-3-Clause）を使用しています。実際のYM2151波形を合成しており、音楽を録音した音声ファイルを埋め込む方式ではありません。原版Z-MUSIC v2.08の著作権者は**西川善司氏**です。本サイトはZ-MUSIC実行形式を配布物に同梱せず、固定された公開元から取得・照合して動作させます。通信に失敗した場合、Z-MUSICを使うPANの再生はできません。

著作権と配布条件は [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)、[ymfmライセンス（公開サイト）](https://layer812.github.io/PanicPlayerWeb/legal/ymfm_LICENSE.txt) を参照してください。個別PANの権利は各作者に帰属します。
