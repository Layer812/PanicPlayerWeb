# Panic Player Web

[English / 英語](README_en.md) · [著作権・謝辞](THIRD_PARTY_NOTICES.md) · [X68K Tab](https://github.com/Layer812/X68KTab5) · [panicplayer for M5Stack Tab5](https://github.com/Layer812/PanicPlayerTab5)

**X68000のPANICアニメーション（`.PAN`）を、現代のWebブラウザで再生するための独立プロジェクトです。**

昔のX68000で親しまれたPANICデータをまた見たい。そのため、オリジナルの **PANIC.X V1.38** を実際の **Musashi Motorola 68000** エミュレーションで実行するWebプレイヤーを開発しています。単に画像を切り替える代替プレイヤーではなく、当時のCPUプログラムとグラフィック・TEXT・スプライト/BG・ADPCMを再現する方針です。

[PanicPlayerTab5](https://github.com/Layer812/PanicPlayerTab5) と [X68K Tab](https://github.com/Layer812/X68KTab5) のPANIC再生への取り組みから生まれた、別のWeb実装です。

## 機能（R16 FIX38）

- 本物のPANIC.Xを実Musashi 68000で実行
- グラフィック・TEXT・スプライト/BG・パレットとR1表示優先順位
- 16MHz設定の仮想CPU、V-DISP同期、遅延時の表示フレーム間引き
- MSM6258 ADPCM再生
- ローカルPANファイル／フォルダ読み込み
- PLAY/STOP・PREV/NEXT・REPEAT・FOLDER AUTO
- 折りたたみ式の診断表示
- 公開リポジトリ `Layer812/PanicPlayerWeb` の `main/pan/` にある正当に公開されたPANだけを一覧化（本体はPLAY操作時のみ取得）

## ソースコードと起動

**ソースコード公開と、誰でもブラウザですぐ遊べるGitHub Pages公開は別です。** このプロジェクトでは、第三者の著作物を不用意に同梱しないよう、原版PANIC.Xと実Musashi CPU WASMを通常の公開ソースZIPには含めません。実際の再生には正当に入手した入力ファイルとEmscriptenによるローカルビルドが必要です。

Windows開発環境の例（Python 3、Node.js 20+、Emscriptenが必要）:

```bat
py -3 tools\START_PLAY.py --source "G:\X68KTab5" --pan "G:\MyPAN\example.PAN"
```

ビルドは `tools/BUILD_R12_ACTUAL.py` を利用し、実PANIC.XのSHA-256を検証します。テストは `npm test` と `python -m pytest -q tests` です。すべてのPANへの互換性や正常終了はまだ保証しません。

## PANデータの権利

PANIC本体の配布許諾は、個々のPAN作品（画像・音楽・動画）の再配布を許可するものではありません。作者・権利者から公開を認められたデータだけを `pan/` に置いてください。サンプルPANは含めません。

## 著作権・謝辞

- **Panic Player Webの新規Web実装**: © 2026 Layer812
- **PANIC / PANIC.X**: 原作者・著作権者 **永田英哉（pako／ぱこたん）さん**、V1.38改訂 **なしみさん**
- **Musashi**: © Karl Stenerud および貢献者、MITライセンス
- **PX68K / WinX68k / xkeropi**: X68000エミュレータの開発・移植・調査に携わった皆様
- **各PAN作品**: 作品ごとの制作・権利者
- **SHARP X68000**: SHARPおよび各権利者の商標・権利。本プロジェクトは非公式・非公認です

原PANICの配布条件と著作権は [PanicPlayerTab5の原資料](https://github.com/Layer812/PanicPlayerTab5/tree/main/docs) を参照してください。詳しくは [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)、[LICENSE_PANIC_X.txt](LICENSE_PANIC_X.txt)、[PANIC_V1.38_NOTICE.txt](PANIC_V1.38_NOTICE.txt)。

**MITライセンスの適用範囲はLayer812が権利を持つ新規コード部分のみです。** 第三者コード、PANIC.X、PAN作品に一括適用しません。

---

PANICとX68000の文化を支え、貴重なデータを保存されてきた皆様に感謝します。
