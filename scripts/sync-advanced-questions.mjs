import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const versions = ['v0.11', 'v0.12'];

for (const version of versions) {
  const fileName = `紫微单盘-进阶提问清单-${version}.md`;
  const source = resolve('..', '产品设计', fileName);
  const target = resolve('content', fileName);

  mkdirSync(dirname(target), { recursive: true });

  if (existsSync(source)) {
    copyFileSync(source, target);
  } else if (!existsSync(target)) {
    throw new Error(`找不到进阶提问清单 ${version}，无法启动网页。`);
  }
}
