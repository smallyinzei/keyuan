// 把打包好的单文件复制到 release/index.html（随仓库分发，可直接双击打开）
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(resolve(root, 'release'), { recursive: true });
copyFileSync(resolve(root, 'dist/index.html'), resolve(root, 'release/index.html'));
console.log(`release/index.html  ${(statSync(resolve(root, 'release/index.html')).size / 1024).toFixed(0)} kB`);
