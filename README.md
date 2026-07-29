# JANKEN RUSH — v0.3「仮面破壊バトル」

**遊ぶ → https://kenkaba.github.io/janken-rush/**

> 言葉は 嘘をつく。**光る手** は 嘘をつかない。

1体の敵を複数回のジャンケンで倒す。3回勝てば仮面を砕いて撃破、3回負ければ敗北。
旧版（連勝を伸ばす単発ジャンケン）は https://kenkaba.github.io/janken-rush/legacy/ に残してある。

---

## 覚えることは1つだけ

GORO は宣言する。ただし **言葉は間違えることがある**。
一方で画面右上に **「出す手」** として光る手は絶対に正しい。目も同じ色に光る。
だから **光る手を見て、それに勝つ手を押す**。

覚醒すると光る手は「遅く出て、すぐ消える」ようになる。
説明文は増やさず、見える時間だけを削って難度を上げる。

| 仮面 | 制限時間 | 光る手が出るまで | 見えている時間 | 言葉 |
|---|---:|---:|---:|---|
| 3（無傷） | 3.0秒 | すぐ | ずっと | 必ず正しい |
| 2（ヒビ） | 2.6秒 | 0.3秒後 | 1.4秒 | 必ず正しい |
| 1（覚醒） | 2.2秒 | 0.7秒後 | 0.75秒 | 30%で間違う |
| CLASH RUSH | 1.0秒 | 0.1秒後 | 0.5秒 | — |

## 1戦の流れ

1. GORO が宣言（例：「次は グー を出す」）
2. 右上に **出す手** が光る
3. 制限時間内に3つの手から選ぶ
4. 勝ち → **仮面を1枚破壊** ／ 負け → **シールドを1枚破壊** ／ あいこ → **CLASH ゲージ上昇**
5. 仮面2枚目が割れると **覚醒**。直後の2ターンは「その手ごと受け止める」＝必ずあいこ
6. あいこ2回で **CLASH RUSH**（1秒5連戦。負けてもシールドは減らない純粋なご褒美）
7. 役物ゲージ満タンで **「下へ引け」**。自分で下へスワイプして巨大役物を落とす
8. 仮面を全部砕いて撃破

**役物は自動で落ちない。** 最後の一撃は必ずプレイヤーが自分の手で発動する。

### 唯一の例外を隠さない

「受け止める」ターンだけは敵の手がプレイヤーの手に依存する（必ずあいこ）。
これは隠れた細工ではなく公開ルールなので、宣言文と画面に
「その手ごと 受け止める」「どれを出しても あいこ」と明示している。
それ以外のターンでは、敵の手はプレイヤーが選ぶ**前**に確定し、以後変わらない。

---

## 自動プレイ30回の結果

| プレイヤー像 | 勝率 | ターン | 被弾 | CLASH RUSH到達 | 役物発動 |
|---|---:|---:|---:|---:|---:|
| 光る手を見る人 | **100%** | 9.0 | 0 | 15/15 | 15/15 |
| 適当に押す人 | **13%** | 7.3 | 2.8 | 12/15 | 3/15 |

見るか見ないかで勝率が 100% と 13% に分かれる。エラー0・演出残骸0。

チュートリアル（初回）の実測ビート：
仮面1枚目 1.9秒 → 覚醒 3.1秒 → 受け止め 4.6秒 → CLASH RUSH 7.0秒 →
5連戦 → 下へ引け 14.7秒 → 撃破 18.5秒
（反応400msのボット計測。初見の人はこの2〜3倍かかる想定）

---

## 公開

| 項目 | 値 |
|---|---|
| 公開URL | https://kenkaba.github.io/janken-rush/ |
| 旧版 | https://kenkaba.github.io/janken-rush/legacy/ |
| 方式 | GitHub Pages（`main` のルートを配信、HTTPS強制） |
| リポジトリ | https://github.com/kenkaba/janken-rush |
| ビルド | 不要（静的ファイルのみ） |

### 更新方法

```bash
cd ~/janken-rush
# コードを直したら index.html の ?v=0.3.0 を上げる（2箇所：CSSとboot.js）
git add -A && git commit -m "..." && git push
```

push から1〜2分でPagesが再ビルドし、`Cache-Control: max-age=600` により最大10分で
新しい `index.html` が届く。届いた時点で `?v=` が変わり、
`boot.js → game.js → core.js / view.js / goro.js` まで一括で新しいURLになる。
Service Worker を使っていないので、古い版が居座り続ける事故は起きない。
ホーム画面へ追加した後も同じ経路で更新される。

### ローカルで動かす

```bash
python3 -c "import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
os.chdir('.')
class H(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control','no-store, max-age=0')
        SimpleHTTPRequestHandler.end_headers(self)
ThreadingHTTPServer(('127.0.0.1',5177),H).serve_forever()"
```

ESモジュール構成のため `file://` では動かない。

---

## iPhone

1. Safariで https://kenkaba.github.io/janken-rush/ を開く
2. 共有ボタン → 「ホーム画面に追加」 → 「追加」
3. ホーム画面のアイコンから全画面（standalone）で起動する

初回のSafariアクセス時だけ手順の案内が出る（閉じると二度と出ない）。

音はiOSの制限で自動再生できないため、タイトルの **最初のタップで AudioContext を作成**する。
バックグラウンド復帰時は `visibilitychange` / `pageshow` で resume を試み、失敗してもゲームは止めない。
iPhoneは振動APIに未対応なので、画面揺れ・白フラッシュ・ボタン沈み・重低音で代替している。

デバッグ表示は `?debug=1` のときだけ出る → https://kenkaba.github.io/janken-rush/?debug=1

---

## ファイル構成

| ファイル | 責務 | DOMに触るか |
|---|---|---|
| `src/core.js` | ルール・GOROの手と宣言・バトル定数・チュートリアル台本 | **触らない** |
| `src/goro.js` | GOROのSVGと破壊段階・ポーズ・目の色 | 触る |
| `src/view.js` | Canvas背景・粒子・WebAudio合成音・HUD・演出 | 触る |
| `src/game.js` | バトル状態機械・画面遷移 | 繋ぐだけ |
| `src/boot.js` | バージョン付きモジュールローダ | — |

勝敗を決めるコードは `core.js` の `judge(playerHand, enemyHand)` ただ一箇所。
`core.js` は `window` にも `document` にも触れない。

## デバッグAPI

`window.JR` から `build` / `state()` / `residue()` / `pick(hand)` / `swipe()` /
`setSpeed(x)` / `startFight()` / `startTutorial()` を利用できる。
`residue()` は演出の残骸（暗転・フラッシュ・粒子数・DOM数）を一括で返す。

## 既知の課題

- **音は未検証**。この開発環境では鳴らして確認できない。実機確認が必要
- BGM無し。テンポが音で加速しない
- 敵はGOROのみ。LYLA / ZERO / VEX は未実装（結果画面にシルエットだけ出る）
- 適当に押す人の勝率13%はやや厳しい。初見の人が最初の1戦で心が折れないか要観察
- GOROは胸から上のみ。全身は未実装

## 次にやること

1. 実機で音とテンポを確認する
2. LYLA（言葉も体も嘘をつく敵）
3. BGMと連勝によるBPM上昇
