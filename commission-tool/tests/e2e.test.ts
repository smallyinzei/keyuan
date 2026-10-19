// 浏览器冒烟测试：用合成数据打开打包后的单文件 dist/index.html。
// 需要先 `npm run build`，并能加载 Playwright（项目内安装，或用 PLAYWRIGHT_MODULE 指向已安装的 playwright 目录）；否则跳过。
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fixtureBytes } from './fixture';

const html = resolve(__dirname, '../dist/index.html');

// 只用到 Playwright 的少量接口；不把它列为依赖，避免安装时下载浏览器
interface PlaywrightLike {
  chromium: { launch(options?: unknown): Promise<any> };
}

async function loadPlaywright(): Promise<PlaywrightLike | null> {
  try {
    if (process.env.PLAYWRIGHT_MODULE) return createRequire(__filename)(process.env.PLAYWRIGHT_MODULE) as PlaywrightLike;
    const name = 'playwright';
    return (await import(/* @vite-ignore */ name)) as PlaywrightLike;
  } catch {
    return null;
  }
}

const pw = existsSync(html) ? await loadPlaywright() : null;

describe.skipIf(!pw)('single-file build in Chromium', () => {
  it('loads offline, computes, exports, and makes no network requests', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'commission-e2e-'));
    const xlsx = join(dir, 'fixture.xlsx');
    writeFileSync(xlsx, fixtureBytes());
    const browser = await pw!.chromium.launch({ env: { ...process.env, LANG: 'C.UTF-8', LC_ALL: 'C.UTF-8' } });
    try {
      const page = await (await browser.newContext({ acceptDownloads: true })).newPage();
      const network: string[] = [];
      const errors: string[] = [];
      page.on('request', (r: any) => {
        const u = r.url();
        if (!/^(file|blob|data):/.test(u)) network.push(u);
      });
      page.on('pageerror', (e: Error) => errors.push(e.message));
      page.on('console', (m: any) => m.type() === 'error' && errors.push(m.text()));
      await page.goto(pathToFileURL(html).href);
      await page.setInputFiles('input[type=file]', xlsx);
      await page.waitForSelector('nav.tabs');
      const text = (await page.textContent('main.content')) ?? '';
      expect(text).toContain('390.00');
      expect(text).toContain('360.00');
      await page.click('nav.tabs button:has-text("导出")');
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('button:has-text("体检报告.xlsx")')]);
      expect(dl.suggestedFilename()).toBe('fixture-体检报告.xlsx');
      expect(network).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await browser.close();
    }
  }, 60_000);
});
