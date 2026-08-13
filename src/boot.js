/* JANKEN RUSH — boot loader */
const v = new URL(import.meta.url).searchParams.get('v') || 'dev';
const q = encodeURIComponent(v);
await import(`./game.js?v=${q}`);
await import(`./result-variety.js?v=${q}`);
