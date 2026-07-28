/* ============================================================
   JANKEN RUSH — boot loader
   index.html の <script src="./src/boot.js?v=X"> の X を
   game.js → core.js / view.js まで伝播させる。

   狙い:
   - バージョンを上げたときだけ全モジュールのURLが変わり、更新が確実に届く
   - 上げなければ通常どおりブラウザキャッシュが効く
   - ホーム画面へ追加した後（standalone）でも同じ仕組みで更新できる
   Service Worker は使っていないので、古い版が居座る事故が起きない。
   ============================================================ */
const v = new URL(import.meta.url).searchParams.get('v') || 'dev';
await import(`./game.js?v=${encodeURIComponent(v)}`);
