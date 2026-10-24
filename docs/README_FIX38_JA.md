# FIX38 — Layer812 GitHub PANライブラリ連携

基準: **FIX37**。実Musashi・CPU 16MHz・描画優先順位・ADPCM・音声付き操作は一切変更しません。

## 使い方

公開リポジトリ `https://github.com/Layer812/PanicPlayerWeb` の **main ブランチ直下 `pan/`** に、ご自身が配布権を持つ `.PAN` を置きます。例: `pan/DENKO1.PAN`。

プレイヤー起動時、`https://api.github.com/repos/Layer812/PanicPlayerWeb/contents/pan?ref=main` から公開ファイルの **ファイル名・サイズ・Git blob SHA** だけを読み込み、ローカルPANと同じ一覧へ追加します。リポジトリやフォルダが空なら、ローカル再生だけ利用できます。

**選択→PLAY** の時だけ固定 `raw.githubusercontent.com/Layer812/PanicPlayerWeb/main/pan/` からPAN本体を取得します。PREV/NEXT、REPEAT、FOLDER AUTOでも同じ既存音声付き再生機構を使用します。インポート済みローカルファイルの外部送信はありません。

安全対策: 任意URL入力・共有URL生成なし、GitHub以外へリダイレクト禁止、Cookie/認証情報不送信、24MiB上限（ストリーム中にも強制）、`.PAN`ファイル名／PANICヘッダ／ファイル長／Git blob SHA照合、必要時のみダウンロード。ブラウザのCORSおよびGitHub側の公開可否に依存します。初回はブラウザのインターネット接続が必要です。

**注意**: このリポジトリは開発時点では空でした。こちらからPANのアップロードは行っていません。権利者の許諾を確認できないPANを公開しないでください。

## 維持内容

FIX37のGUI、D17SLOWで確立した16MHz同期、画像パレット補正、CYNTHIAとR1の優先順位、ADPCM、PLAY/STOP・PREV/NEXT・REPEAT・FOLDER AUTO、診断折り畳みはそのままです。GitHub PANのWindows実ブラウザ再生はまだ未確認です。