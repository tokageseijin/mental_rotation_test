# Mental Rotation Trainer / 立体回転トレーナー

イラストレーターの立体把握（メンタルローテーション）能力を、クイズ形式で鍛える
ブラウザアプリ。3Dオブジェクトに回転操作を加えたときの見え方を当てて、習熟度を
推定しランクで可視化する。GitHub Pages で配信可能。

## 主な機能（MVP / フェーズA）

- **4択クイズ**: 課題オブジェクト＋回転指示に対し、正解1枚＋ダミー3枚から選ぶ。
  ダミーは「軸違い/符号違い/量違い/グローバル・ローカル取り違え/鏡像」に分類し、
  どこを間違えやすいかを記録・分析。
- **習熟度推定とランク**: Elo風レーティングでランク（アイアン→…→グランドマスター）を
  4択・ドローイングの **モード別** に集計。
- **モデルライブラリ**: 手続き生成のプリセット（抽象ブロック＋具象）に加え、
  ユーザーのGLB/glTFを追加。File System Access API 対応ブラウザではファイルを
  「記憶」し、一覧から再選択できる（未対応環境はファイル内容を保存）。
- **成績分析**: 軸別・回転種別・難易度帯別の正答率、誤答種別ランキング、
  「易しいのにミス／難しくてミス」の区別。
- **データ所有**: 設定・成績はブラウザ内保存。JSONでエクスポート/インポート。
- **ペン/マウス対応**: Pointer Events に統一。ページ全体でペンのタップを通常操作として扱う。

## フェーズB（予定）

- ドローイングモード（筆圧対応キャンバス＋4段階自己評価）
- 誤答分析のチャート化、実GLBの具象モデル追加 など

## 開発

```bash
npm install
npm run dev        # 開発サーバ
npm run build      # 型チェック + 本番ビルド (dist/)
npm run preview    # ビルド結果をプレビュー
```

## GitHub Pages へのデプロイ

`main` へ push すると [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) が
`VITE_BASE=/<repo>/` でビルドして Pages へ公開する。リポジトリの Settings → Pages で
Source を「GitHub Actions」に設定するだけ。

> File System Access API は HTTPS でのみ動作するため、Pages 上でユーザーモデル追加が使える。

## 設計根拠

UIの意思決定は [`docs/design-rationale.md`](docs/design-rationale.md) を参照。

## 技術スタック

React 18 / TypeScript / Vite / Three.js（@react-three/fiber, drei） / Zustand / idb-keyval
