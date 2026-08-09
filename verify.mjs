import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { judge } from './src/core.js';

const jsFiles = ['src/boot.js', 'src/core.js', 'src/game.js', 'src/goro.js', 'src/view.js'];
const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) failures.push(`${file}: ${result.stderr.trim()}`);
}

const [html, game] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('src/game.js', 'utf8'),
]);

const versions = [...html.matchAll(/[?&]v=([0-9]+\.[0-9]+\.[0-9]+)/g)].map((match) => match[1]);
const gameVersion = game.match(/BUILD\s*=\s*\{\s*version:\s*'([^']+)'/)?.[1];

check(versions.length === 2, 'index.html: expected versioned CSS and boot.js URLs');
check(new Set(versions).size === 1, 'index.html: CSS and JavaScript cache versions differ');
check(gameVersion === versions[0], 'src/game.js BUILD.version must match index.html ?v= values');
check(/<meta name="jr-build" content="[^"]+"\s*\/?>/.test(html), 'index.html: missing jr-build release marker');
check(judge('rock', 'scissors') === 'win', 'core rule failed: rock must beat scissors');
check(judge('scissors', 'paper') === 'win', 'core rule failed: scissors must beat paper');
check(judge('paper', 'rock') === 'win', 'core rule failed: paper must beat rock');
check(judge('rock', 'rock') === 'draw', 'core rule failed: equal hands must draw');
check(judge('rock', 'paper') === 'lose', 'core rule failed: rock must lose to paper');

if (failures.length) {
  console.error(`JANKEN RUSH verification failed (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('JANKEN RUSH verification passed.');
console.log(`Checked ${jsFiles.length} modules, release versions, build marker, and core rules.`);

