#!/usr/bin/env node
// KEN-66: ブラウザ演習6件を実 Chrome (CDP) で自動検証する。
//  - 依存パッケージなし。Node の グローバル WebSocket / fetch と CDP のみ。
//  - localhost だけを使う。外部ネットワークへは接続しない。
//  - 1.4 は検証用ダミーデータのみを扱う (実ブラウザ履歴は読まない)。
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Browser, waitForEndpoint, waitFor, sleep } from './lib/cdp.mjs';
import { startServer } from './lib/server.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const LOGS = path.join(HERE, 'logs');
const SHOTS = path.join(HERE, 'screenshots');
const BUILD = path.join(HERE, 'build');
const CHROME = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const HEADFUL = process.env.KEN66_HEADFUL === '1';

await fs.mkdir(LOGS, { recursive: true });
await fs.mkdir(SHOTS, { recursive: true });

const PORTS = { '1.4': 8641, '4.1': 8642, '4.2': 8643, '6.4': 8644, '9.2': 8645, '24.5': 8646 };

// ---------------------------------------------------------------- 計測用の注入スクリプト
const INSTRUMENT = `(() => {
  if (window.__ken66) return;
  window.__ken66 = { csp: [], vitals: { LCP: null, CLS: 0, INP: null, FID: null }, sw: [] };
  document.addEventListener('securitypolicyviolation', (e) => {
    window.__ken66.csp.push({ directive: e.effectiveDirective, blockedURI: e.blockedURI, disposition: e.disposition, sourceFile: e.sourceFile, line: e.lineNumber });
  });
  try {
    const supported = PerformanceObserver.supportedEntryTypes || [];
    const obs = (type, fn, extra) => { if (supported.includes(type)) new PerformanceObserver((l) => { for (const e of l.getEntries()) fn(e); }).observe({ type, buffered: true, ...(extra || {}) }); };
    obs('largest-contentful-paint', (e) => { window.__ken66.vitals.LCP = Math.round(e.startTime); });
    obs('layout-shift', (e) => { if (!e.hadRecentInput) window.__ken66.vitals.CLS = Number((window.__ken66.vitals.CLS + e.value).toFixed(4)); });
    obs('event', (e) => { window.__ken66.vitals.INP = Math.max(window.__ken66.vitals.INP || 0, Math.round(e.duration)); }, { durationThreshold: 16 });
    obs('first-input', (e) => { window.__ken66.vitals.FID = Math.round(e.processingStart - e.startTime); });
  } catch (error) { window.__ken66.vitalsError = String(error); }
  if (navigator.serviceWorker) {
    const track = (worker, label) => {
      if (!worker) return;
      window.__ken66.sw.push(label + ':' + worker.state);
      worker.addEventListener('statechange', () => window.__ken66.sw.push(label + ':' + worker.state));
    };
    const original = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = (...args) => original(...args).then((registration) => {
      track(registration.installing, 'installing');
      track(registration.waiting, 'waiting');
      track(registration.active, 'active');
      registration.addEventListener('updatefound', () => track(registration.installing, 'updatefound'));
      return registration;
    });
  }
})();`;

// ---------------------------------------------------------------- Chrome 起動
async function launchChrome() {
  const userDataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ken66-chrome-'));
  const args = [
    HEADFUL ? '--headless=old-disabled' : '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--window-size=1280,900',
    '--force-device-scale-factor=1',
    // 外部通信を確実に断つ: 非 loopback 宛はすべて存在しないプロキシへ送る
    // (Chrome は loopback を既定でプロキシ迂回するため localhost だけが到達可能)
    '--proxy-server=http://127.0.0.1:1',
    '--disable-component-update',
    '--disable-sync',
    '--metrics-recording-only',
    '--no-pings',
    'about:blank',
  ].filter((a) => a !== '--headless=old-disabled');

  const child = spawn(CHROME, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  const stderrChunks = [];
  child.stderr.on('data', (d) => stderrChunks.push(d));
  const portFile = path.join(userDataDir, 'DevToolsActivePort');
  const port = await waitFor(
    async () => {
      if (!fsSync.existsSync(portFile)) return null;
      const line = (await fs.readFile(portFile, 'utf8')).split('\n')[0].trim();
      return line ? Number(line) : null;
    },
    { timeout: 25000, label: 'DevToolsActivePort' },
  ).catch((error) => {
    throw new Error(`${error.message}\nchrome stderr: ${Buffer.concat(stderrChunks).toString().slice(-2000)}`);
  });
  const version = await waitForEndpoint(port);
  return { child, port, userDataDir, version, stderrChunks };
}

// ---------------------------------------------------------------- ページセッション
class PageSession {
  constructor(browser, sessionId, targetId) {
    this.browser = browser;
    this.sessionId = sessionId;
    this.targetId = targetId;
    this.phase = 'main';
    this.console = [];
    this.exceptions = [];
    this.networkFailures = [];
    this.logEntries = [];
    this.requests = [];
    this.documentRequests = [];
    this.swVersions = [];
  }

  async init() {
    const s = this.sessionId;
    await this.browser.send('Page.enable', {}, s);
    await this.browser.send('Runtime.enable', {}, s);
    await this.browser.send('Log.enable', {}, s);
    await this.browser.send('Network.enable', {}, s);
    await this.browser.send('Page.setLifecycleEventsEnabled', { enabled: true }, s);
    // Layout/RecalcStyle のカウンタはナビゲーション前に有効化しないと積算されない
    await this.browser.send('Performance.enable', { timeDomain: 'timeTicks' }, s).catch(() => {});
    await this.browser.send('Page.addScriptToEvaluateOnNewDocument', { source: INSTRUMENT }, s);
  }

  handle(message) {
    const { method, params } = message;
    if (method === 'Runtime.consoleAPICalled') {
      if (['error', 'warning', 'assert'].includes(params.type)) {
        this.console.push({
          phase: this.phase,
          level: params.type,
          text: (params.args ?? []).map((a) => a.value ?? a.description ?? a.type).join(' '),
        });
      }
    } else if (method === 'Runtime.exceptionThrown') {
      this.exceptions.push({
        phase: this.phase,
        text: params.exceptionDetails?.exception?.description ?? params.exceptionDetails?.text,
      });
    } else if (method === 'Log.entryAdded') {
      const entry = params.entry;
      if (['error', 'warning'].includes(entry.level)) {
        this.logEntries.push({ phase: this.phase, level: entry.level, source: entry.source, text: entry.text, url: entry.url });
      }
    } else if (method === 'Network.requestWillBeSent') {
      this.requests.push({ phase: this.phase, url: params.request.url, type: params.type });
      if (params.type === 'Document') this.documentRequests.push({ phase: this.phase, url: params.request.url });
    } else if (method === 'ServiceWorker.workerVersionUpdated') {
      for (const version of params.versions ?? []) {
        this.swVersions.push({ status: version.status, runningStatus: version.runningStatus, scriptURL: version.scriptURL });
      }
    } else if (method === 'Network.loadingFailed') {
      this.networkFailures.push({ phase: this.phase, error: params.errorText, type: params.type, canceled: params.canceled });
    }
  }

  send(method, params = {}) {
    return this.browser.send(method, params, this.sessionId);
  }

  async evaluate(expression, { awaitPromise = false } = {}) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise,
      userGesture: false,
    });
    if (result.exceptionDetails) {
      throw new Error(`evaluate failed: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}\n--- expr ---\n${expression}`);
    }
    return result.result?.value;
  }

  async navigate(url) {
    const loaded = this.waitForLoad();
    await this.send('Page.navigate', { url });
    await loaded;
    await this.send('Page.bringToFront').catch(() => {});
  }

  waitForLoad(timeout = 20000) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(new Error('load event timeout'));
      }, timeout);
      const off = this.browser.on((message) => {
        if (message.sessionId === this.sessionId && message.method === 'Page.loadEventFired') {
          clearTimeout(timer);
          off();
          resolve();
        }
      });
    });
  }

  async clickElement(elementExpression) {
    const point = await this.evaluate(
      `(() => { const el = ${elementExpression}; if (!el) throw new Error('element not found: ${elementExpression.replace(/'/g, "")}'); el.scrollIntoView({block:'center'}); const r = el.getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; })()`,
    );
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await this.send('Input.dispatchMouseEvent', {
        type,
        x: point.x,
        y: point.y,
        button: 'left',
        buttons: type === 'mousePressed' ? 1 : 0,
        clickCount: type === 'mouseMoved' ? 0 : 1,
      });
    }
    await sleep(60);
  }

  async typeInto(selector, text) {
    await this.clickElement(`document.querySelector('${selector}')`);
    await this.send('Input.insertText', { text });
    await sleep(30);
  }

  async screenshot(file) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile(file, Buffer.from(data, 'base64'));
    return file;
  }

  async diagnostics() {
    const injected = await this.evaluate('window.__ken66 ? JSON.parse(JSON.stringify(window.__ken66)) : null');
    return {
      consoleErrors: this.console.filter((c) => c.phase === 'main' && c.level !== 'warning'),
      consoleWarnings: this.console.filter((c) => c.phase === 'main' && c.level === 'warning'),
      exceptions: this.exceptions.filter((e) => e.phase === 'main'),
      logErrors: this.logEntries.filter((e) => e.phase === 'main' && e.level === 'error'),
      logWarnings: this.logEntries.filter((e) => e.phase === 'main' && e.level === 'warning'),
      networkFailures: this.networkFailures.filter((f) => f.phase === 'main' && !f.canceled),
      networkFailuresOffline: this.networkFailures.filter((f) => f.phase !== 'main'),
      cspViolations: injected?.csp ?? [],
      vitals: injected?.vitals ?? null,
      swLifecycle: injected?.sw ?? [],
      documentRequests: this.documentRequests,
      requestCount: this.requests.length,
    };
  }
}

// ---------------------------------------------------------------- ブラウザ制御
class Driver {
  constructor(browser) {
    this.browser = browser;
    this.pages = new Map();
    this.serviceWorkerSessions = new Map(); // sessionId -> targetInfo
    this.attachedTargetIds = new Set();
    this.browserServiceWorkerEvents = [];
    browser.on((message) => this.#route(message));
  }

  #route(message) {
    if (message.method === 'Target.attachedToTarget') {
      const { sessionId, targetInfo } = message.params;
      this.attachedTargetIds.add(targetInfo.targetId);
      if (targetInfo.type === 'service_worker') {
        this.serviceWorkerSessions.set(sessionId, targetInfo);
        this.browser.send('Network.enable', {}, sessionId).catch(() => {});
        if (this.offline) this.#applyOffline(sessionId, true).catch(() => {});
      }
      return;
    }
    if (message.method === 'ServiceWorker.workerVersionUpdated' && !message.sessionId) {
      for (const version of message.params.versions ?? []) {
        this.browserServiceWorkerEvents.push({ status: version.status, runningStatus: version.runningStatus, scriptURL: version.scriptURL });
      }
      return;
    }
    if (message.method === 'Target.detachedFromTarget') {
      this.serviceWorkerSessions.delete(message.params.sessionId);
      return;
    }
    if (message.sessionId && this.pages.has(message.sessionId)) {
      this.pages.get(message.sessionId).handle(message);
    }
  }

  async init() {
    await this.browser.send('Target.setDiscoverTargets', { discover: true });
    await this.browser.send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
    await this.browser.send('ServiceWorker.enable').catch(() => {});
  }

  // Target.setAutoAttach で取りこぼした service_worker ターゲットを明示 attach する
  async attachServiceWorkers() {
    const { targetInfos } = await this.browser.send('Target.getTargets');
    for (const info of targetInfos) {
      if (info.type !== 'service_worker' || this.attachedTargetIds.has(info.targetId)) continue;
      try {
        const { sessionId } = await this.browser.send('Target.attachToTarget', { targetId: info.targetId, flatten: true });
        this.attachedTargetIds.add(info.targetId);
        this.serviceWorkerSessions.set(sessionId, info);
        await this.browser.send('Network.enable', {}, sessionId).catch(() => {});
      } catch {
        /* すでに attach 済みなら無視 */
      }
    }
    return [...this.serviceWorkerSessions.values()].map((i) => i.url);
  }

  async newPage() {
    const { targetId } = await this.browser.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await this.browser.send('Target.attachToTarget', { targetId, flatten: true });
    const page = new PageSession(this.browser, sessionId, targetId);
    this.pages.set(sessionId, page);
    await page.init();
    return page;
  }

  async closePage(page) {
    this.pages.delete(page.sessionId);
    await this.browser.send('Target.closeTarget', { targetId: page.targetId }).catch(() => {});
  }

  #applyOffline(sessionId, offline) {
    return this.browser.send(
      'Network.emulateNetworkConditions',
      { offline, latency: 0, downloadThroughput: offline ? 0 : -1, uploadThroughput: offline ? 0 : -1 },
      sessionId,
    );
  }

  // page とすべての service_worker ターゲットへ offline を適用する。
  async setOffline(page, offline) {
    this.offline = offline;
    await this.attachServiceWorkers().catch(() => {});
    const targets = [page.sessionId, ...this.serviceWorkerSessions.keys()];
    for (const sessionId of targets) {
      await this.#applyOffline(sessionId, offline).catch((error) => {
        console.error(`  [warn] emulateNetworkConditions(${sessionId}) failed: ${error.message}`);
      });
    }
    return targets.length;
  }
}

// ---------------------------------------------------------------- ログ出力ヘルパ
function makeLogger(file) {
  const lines = [];
  const write = (...args) => {
    const line = args.join(' ');
    lines.push(line);
    console.log(line);
  };
  write.save = () => fs.writeFile(file, lines.join('\n') + '\n', 'utf8');
  write.quiet = (line) => lines.push(line);
  return write;
}

function judge(checks) {
  return checks.every((c) => c.ok) ? 'PASS' : 'FAIL';
}

// ---------------------------------------------------------------- 各演習
const results = [];

async function runExercise(id, title, fn) {
  const started = Date.now();
  const log = makeLogger(path.join(LOGS, `${id}-verify.out`));
  log(`=== 課題${id} ${title} ===`);
  log(`開始: ${new Date(started).toISOString()}`);
  let record;
  try {
    record = await fn(log);
  } catch (error) {
    log(`ERROR: ${error.stack ?? error.message}`);
    record = { checks: [{ name: '実行完了', ok: false, detail: String(error.message) }], metrics: {}, screenshot: null };
  }
  const elapsedMs = Date.now() - started;
  const verdict = judge(record.checks);
  log('--- チェック結果 ---');
  for (const c of record.checks) log(`  ${c.ok ? 'PASS' : 'FAIL'}: ${c.name}${c.detail ? ` (${c.detail})` : ''}`);
  log(`所要時間: ${(elapsedMs / 1000).toFixed(2)} 秒`);
  log(`判定: ${verdict}`);
  await log.save();
  results.push({ id, title, port: record.port ?? null, elapsedMs, verdict, ...record });
  console.log(`\n>>> ${id} ${verdict} (${(elapsedMs / 1000).toFixed(2)}s)\n`);
}

function diagChecks(diag, { allowWarnings = true } = {}) {
  const criticalConsole = [...diag.consoleErrors, ...diag.exceptions, ...diag.logErrors];
  const checks = [
    { name: 'Console 重大エラー0件', ok: criticalConsole.length === 0, detail: criticalConsole.map((c) => c.text).join(' | ') },
    { name: 'Network 失敗0件', ok: diag.networkFailures.length === 0, detail: diag.networkFailures.map((f) => f.error).join(' | ') },
    { name: 'CSP 違反0件', ok: diag.cspViolations.length === 0, detail: diag.cspViolations.map((v) => `${v.directive}<-${v.blockedURI}`).join(' | ') },
  ];
  if (!allowWarnings) {
    checks.push({ name: 'Console 警告0件', ok: diag.consoleWarnings.length + diag.logWarnings.length === 0 });
  }
  return checks;
}

// ================================================================ main
const chrome = await launchChrome();
console.log(`Chrome: ${chrome.version.Browser} / DevTools port ${chrome.port} / headless=${!HEADFUL}`);
await fs.writeFile(
  path.join(LOGS, 'environment.txt'),
  [
    `date: ${new Date().toISOString()}`,
    `node: ${process.version}`,
    `platform: ${process.platform} ${os.release()} ${process.arch}`,
    `chrome: ${chrome.version.Browser}`,
    `protocol: ${chrome.version['Protocol-Version']}`,
    `userAgent: ${chrome.version['User-Agent']}`,
    `headless: ${!HEADFUL}`,
    `devtoolsPort: ${chrome.port}`,
  ].join('\n') + '\n',
);

const browser = await Browser.connect(chrome.version.webSocketDebuggerUrl);
const driver = new Driver(browser);
await driver.init();

const cleanupServers = [];
async function serve(root, port, log) {
  const server = await startServer({ root, port, log: (line) => log.quiet(`  [http:${port}] ${line}`) });
  cleanupServers.push(server);
  log(`localhost サーバ起動: ${server.origin} (root=${path.relative(ROOT, root)})`);
  return server;
}

// ---------------------------------------------------------------- 1.4 使用履歴の可視化
await runExercise('1.4', '自分のWebの「使用履歴」を可視化', async (log) => {
  const port = PORTS['1.4'];
  const server = await serve(path.join(HERE, 'fixtures/ex1_4'), port, log);
  log('※ 実ブラウザ履歴は使用しない。fixtures/ex1_4/history.json のダミーデータのみ。');

  const page = await driver.newPage();
  await page.navigate(`${server.origin}/index.html`);
  await sleep(400);

  const viz = await page.evaluate('window.__ex14');
  log(`可視化: バー ${viz.bars} 本 / 分類表 ${viz.rows} 行 / ダミーデータ限定=${viz.dummyOnly}`);

  // 遷移方式の観察: SPA 遷移は Document リクエストを発生させない
  const docsBefore = page.documentRequests.length;
  const spaLoaded = page.waitForLoad();
  await page.clickElement("document.querySelector('#to-spa')");
  await spaLoaded;
  await sleep(200);
  const docsAfterLink = page.documentRequests.length;
  await page.clickElement("document.querySelectorAll('[data-route]')[1]");
  await page.clickElement("document.querySelectorAll('[data-route]')[2]");
  await sleep(200);
  const docsAfterSpa = page.documentRequests.length;
  const spaState = await page.evaluate("({ url: location.href, view: document.querySelector('#view').textContent, navCount: window.__navCount })");
  log(`Document リクエスト: 初期→リンク遷移で +${docsAfterLink - docsBefore} / SPA遷移2回で +${docsAfterSpa - docsAfterLink}`);
  log(`SPA 状態: url=${spaState.url} view=${spaState.view} navCount=${spaState.navCount}`);

  await page.navigate(`${server.origin}/index.html`);
  await sleep(300);
  const shot = path.join(SHOTS, '1.4.png');
  await page.screenshot(shot);

  const diag = await page.diagnostics();
  await driver.closePage(page);
  await server.close();
  cleanupServers.splice(cleanupServers.indexOf(server), 1);

  return {
    port,
    screenshot: path.relative(ROOT, shot),
    additionalLogs: ['.verification/ken66/logs/1.4-measure-http.out'],
    metrics: {
      chartBars: viz.bars,
      tableRows: viz.rows,
      dummyDataOnly: viz.dummyOnly,
      documentRequestsOnLinkNavigation: docsAfterLink - docsBefore,
      documentRequestsOnSpaNavigation: docsAfterSpa - docsAfterLink,
      spaFinalView: spaState.view,
      consoleWarnings: diag.consoleWarnings.length + diag.logWarnings.length,
    },
    checks: [
      { name: '履歴グラフが8本描画される', ok: viz.bars === 8, detail: `bars=${viz.bars}` },
      { name: '分類表が8行描画される', ok: viz.rows === 8, detail: `rows=${viz.rows}` },
      { name: 'ダミーデータのみ使用', ok: viz.dummyOnly === true },
      { name: '通常リンク遷移で Document リクエストが発生', ok: docsAfterLink - docsBefore === 1 },
      { name: 'SPA遷移では Document リクエストが発生しない', ok: docsAfterSpa - docsAfterLink === 0 },
      { name: 'SPA遷移で URL と表示が更新される', ok: spaState.view === 'settings' && spaState.url.includes('view=settings') },
      ...diagChecks(diag),
    ],
    diagnostics: diag,
  };
});

// ---------------------------------------------------------------- 4.1 レンダリングパイプライン計測
await runExercise('4.1', 'レンダリングパイプラインを計測する', async (log) => {
  const port = PORTS['4.1'];
  const server = await serve(path.join(ROOT, 'code/ch04/render-bench'), port, log);

  const page = await driver.newPage();
  await page.navigate(`${server.origin}/index.solution.html`);
  await sleep(500);

  const initialItems = await page.evaluate("document.querySelectorAll('#stage .item').length");
  log(`初期描画: .item = ${initialItems} 個`);

  const durations = {};
  for (const mode of ['bad', 'better', 'best']) {
    await page.clickElement(`document.querySelector('[data-mode="${mode}"]')`);
    const text = await page.evaluate(
      `new Promise((resolve) => { const check = () => { const t = document.querySelector('#result').textContent; if (t.startsWith('${mode}:')) resolve(t); else setTimeout(check, 50); }; check(); })`,
      { awaitPromise: true },
    );
    const ms = Number(/([\d.]+) ms/.exec(text)?.[1]);
    durations[mode] = ms;
    log(`${mode}: performance.measure = ${ms} ms`);
    await sleep(300);
  }

  // Performance ドメイン (init で enable 済み) から Layout/Recalc の実測値を取る
  const perf = await page.send('Performance.getMetrics');
  const metricMap = Object.fromEntries(perf.metrics.map((m) => [m.name, m.value]));
  log(`LayoutCount=${metricMap.LayoutCount} RecalcStyleCount=${metricMap.RecalcStyleCount} LayoutDuration=${metricMap.LayoutDuration?.toFixed(4)}s RecalcStyleDuration=${metricMap.RecalcStyleDuration?.toFixed(4)}s`);

  // Web Vitals (注入した PerformanceObserver から)
  await sleep(400);
  const vitals = await page.evaluate('JSON.parse(JSON.stringify(window.__ken66.vitals))');
  log(`Web Vitals: LCP=${vitals.LCP}ms CLS=${vitals.CLS} INP=${vitals.INP}ms FID=${vitals.FID}ms`);

  const shot = path.join(SHOTS, '4.1.png');
  await page.screenshot(shot);
  const diag = await page.diagnostics();
  await driver.closePage(page);
  await server.close();
  cleanupServers.splice(cleanupServers.indexOf(server), 1);

  return {
    port,
    screenshot: path.relative(ROOT, shot),
    metrics: {
      items: initialItems,
      measureMs: durations,
      layoutCount: metricMap.LayoutCount,
      recalcStyleCount: metricMap.RecalcStyleCount,
      layoutDurationSec: metricMap.LayoutDuration,
      recalcStyleDurationSec: metricMap.RecalcStyleDuration,
      webVitals: vitals,
    },
    checks: [
      { name: 'ステージに1000要素が生成される', ok: initialItems === 1000, detail: `items=${initialItems}` },
      { name: 'Bad の計測値が取得できる', ok: Number.isFinite(durations.bad), detail: `${durations.bad}ms` },
      { name: 'Better の計測値が取得できる', ok: Number.isFinite(durations.better), detail: `${durations.better}ms` },
      { name: 'Best の計測値が取得できる', ok: Number.isFinite(durations.best), detail: `${durations.best}ms` },
      { name: 'Bad が最も遅い (強制同期レイアウトを再現)', ok: durations.bad > durations.better && durations.bad > durations.best, detail: `bad=${durations.bad} better=${durations.better} best=${durations.best}` },
      { name: 'Layout が複数回発生している', ok: metricMap.LayoutCount > 0, detail: `LayoutCount=${metricMap.LayoutCount}` },
      { name: 'LCP を実測できた', ok: Number.isFinite(vitals.LCP), detail: `${vitals.LCP}ms` },
      { name: 'CLS を実測できた', ok: Number.isFinite(vitals.CLS), detail: `${vitals.CLS}` },
      { name: 'INP(event duration) を実測できた', ok: Number.isFinite(vitals.INP), detail: `${vitals.INP}ms` },
      ...diagChecks(diag),
    ],
    diagnostics: diag,
  };
});

// ---------------------------------------------------------------- 4.2 DOM API による Todo アプリ
await runExercise('4.2', '純粋なDOM APIでTodoアプリ', async (log) => {
  const port = PORTS['4.2'];
  const buildRoot = path.join(BUILD, 'ch04');
  await fs.access(path.join(buildRoot, 'todo-vanilla/solution/app.js'));
  await fs.copyFile(
    path.join(ROOT, 'code/ch04/todo-vanilla/solution/index.html'),
    path.join(buildRoot, 'todo-vanilla/solution/index.html'),
  );
  log('tsc 出力を配置: build/ch04/todo-vanilla/solution/{app.js,index.html}');
  const server = await serve(buildRoot, port, log);

  const page = await driver.newPage();
  await page.navigate(`${server.origin}/todo-vanilla/solution/index.html`);
  await page.evaluate("localStorage.removeItem('handbook-ch04-todos')");
  await page.navigate(`${server.origin}/todo-vanilla/solution/index.html`);
  await sleep(300);

  for (const text of ['牛乳を買う', 'CDP で検証する', 'レポートを書く']) {
    await page.typeInto('#todo-input', text);
    await page.clickElement("document.querySelector('#todo-form button')");
    await sleep(80);
  }
  let state = await page.evaluate("({ count: document.querySelectorAll('#todo-list li').length, status: document.querySelector('#status').textContent })");
  log(`追加後: ${state.count}件 / status="${state.status}"`);
  const afterAdd = { ...state };

  // 1件目を完了にする
  await page.clickElement("document.querySelector('#todo-list li input[type=checkbox]')");
  await sleep(100);
  const afterToggle = await page.evaluate("({ count: document.querySelectorAll('#todo-list li').length, completed: document.querySelectorAll('#todo-list li.completed').length, status: document.querySelector('#status').textContent })");
  log(`完了切替後: completed=${afterToggle.completed} status="${afterToggle.status}"`);

  const filters = {};
  for (const name of ['active', 'completed', 'all']) {
    await page.clickElement(`document.querySelector('[data-filter="${name}"]')`);
    await sleep(80);
    filters[name] = await page.evaluate(`({ visible: document.querySelectorAll('#todo-list li').length, pressed: document.querySelector('[data-filter="${name}"]').getAttribute('aria-pressed') })`);
    log(`フィルター ${name}: 表示 ${filters[name].visible} 件 / aria-pressed=${filters[name].pressed}`);
  }

  // localStorage 永続化を再読込で確認
  const stored = await page.evaluate("JSON.parse(localStorage.getItem('handbook-ch04-todos') ?? '[]').length");
  await page.navigate(`${server.origin}/todo-vanilla/solution/index.html`);
  await sleep(300);
  const afterReload = await page.evaluate("document.querySelectorAll('#todo-list li').length");
  log(`localStorage: ${stored}件保存 / 再読込後の表示 ${afterReload}件`);

  // Ctrl+Enter で全完了 (キーボードショートカット)
  await page.evaluate("document.querySelector('#todo-input').focus()");
  await page.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers: 2 });
  await page.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers: 2 });
  await sleep(150);
  const afterShortcut = await page.evaluate("({ completed: document.querySelectorAll('#todo-list li.completed').length, status: document.querySelector('#status').textContent })");
  log(`Ctrl+Enter 後: completed=${afterShortcut.completed} status="${afterShortcut.status}"`);

  // 削除
  await page.clickElement("[...document.querySelectorAll('#todo-list li button')].at(-1)");
  await sleep(150);
  const afterDelete = await page.evaluate("document.querySelectorAll('#todo-list li').length");
  log(`削除後: ${afterDelete}件`);

  const shot = path.join(SHOTS, '4.2.png');
  await page.screenshot(shot);
  const diag = await page.diagnostics();
  await driver.closePage(page);
  await server.close();
  cleanupServers.splice(cleanupServers.indexOf(server), 1);

  return {
    port,
    screenshot: path.relative(ROOT, shot),
    metrics: { afterAdd, afterToggle, filters, storedCount: stored, afterReload, afterShortcut, afterDelete },
    checks: [
      { name: 'Todo を3件追加できる', ok: afterAdd.count === 3, detail: `count=${afterAdd.count}` },
      { name: 'aria-live の残件表示が更新される', ok: afterAdd.status === '3件が未完了', detail: afterAdd.status },
      { name: '完了切替が反映される', ok: afterToggle.completed === 1 && afterToggle.status === '2件が未完了', detail: afterToggle.status },
      { name: 'Active フィルターが未完了2件を表示', ok: filters.active.visible === 2 && filters.active.pressed === 'true' },
      { name: 'Completed フィルターが完了1件を表示', ok: filters.completed.visible === 1 && filters.completed.pressed === 'true' },
      { name: 'All フィルターが3件を表示', ok: filters.all.visible === 3 && filters.all.pressed === 'true' },
      { name: 'localStorage に永続化され再読込後も残る', ok: stored === 3 && afterReload === 3, detail: `stored=${stored} reload=${afterReload}` },
      { name: 'Ctrl+Enter で全件完了になる', ok: afterShortcut.completed === 3 && afterShortcut.status === '0件が未完了', detail: afterShortcut.status },
      { name: '削除で1件減る', ok: afterDelete === 2, detail: `count=${afterDelete}` },
      ...diagChecks(diag),
    ],
    diagnostics: diag,
  };
});

// ---------------------------------------------------------------- 6.4 Web Components による Counter
await runExercise('6.4', 'Web Components で型安全な Counter', async (log) => {
  const port = PORTS['6.4'];
  const server = await serve(path.join(ROOT, 'code/ch06/web-component-counter/solution'), port, log);

  const page = await driver.newPage();
  await page.navigate(`${server.origin}/main.html`);
  await sleep(300);

  const upgraded = await page.evaluate(
    "({ defined: !!customElements.get('my-counter'), hasShadow: !!document.querySelector('my-counter').shadowRoot, mode: document.querySelector('my-counter').shadowRoot?.mode, initial: document.querySelector('my-counter').shadowRoot.querySelector('[part=value]').textContent, value: document.querySelector('my-counter').value, log: document.querySelector('#log').value })",
  );
  log(`定義=${upgraded.defined} shadowRoot=${upgraded.hasShadow}(${upgraded.mode}) 初期値=${upgraded.initial} value=${upgraded.value}`);

  // Shadow DOM 内のボタンを実クリックする
  const inc = "document.querySelector('my-counter').shadowRoot.querySelector('[part=increment]')";
  const dec = "document.querySelector('my-counter').shadowRoot.querySelector('[part=decrement]')";
  const events = [];
  await page.evaluate("window.__changes = []; document.querySelector('my-counter').addEventListener('change', (e) => window.__changes.push(e.detail.value));");
  await page.clickElement(inc);
  await page.clickElement(inc);
  await page.clickElement(dec);
  await sleep(120);
  const afterClicks = await page.evaluate(
    "({ shown: document.querySelector('my-counter').shadowRoot.querySelector('[part=value]').textContent, value: document.querySelector('my-counter').value, log: document.querySelector('#log').value, changes: window.__changes })",
  );
  events.push(...afterClicks.changes);
  log(`+2 +2 -2 後: 表示=${afterClicks.shown} value=${afterClicks.value} <output>=${afterClicks.log} change イベント=${JSON.stringify(afterClicks.changes)}`);

  // 属性反映 (observedAttributes / attributeChangedCallback)
  await page.evaluate("document.querySelector('my-counter').setAttribute('initial', '100')");
  await sleep(80);
  const afterAttr = await page.evaluate("({ shown: document.querySelector('my-counter').shadowRoot.querySelector('[part=value]').textContent, value: document.querySelector('my-counter').value })");
  log(`initial=100 属性変更後: 表示=${afterAttr.shown} value=${afterAttr.value}`);

  // プロパティ経由の書き込み
  await page.evaluate("document.querySelector('my-counter').value = 7");
  await sleep(80);
  const afterProp = await page.evaluate("({ shown: document.querySelector('my-counter').shadowRoot.querySelector('[part=value]').textContent, log: document.querySelector('#log').value })");
  log(`value=7 設定後: 表示=${afterProp.shown} <output>=${afterProp.log}`);

  // スタイル隔離: :host のスタイルは外へ漏れない
  const isolation = await page.evaluate(
    "(() => { const host = document.querySelector('my-counter'); const inner = host.shadowRoot.querySelector('button'); return { innerMinWidth: getComputedStyle(inner).minWidth, outerButtonExists: document.querySelectorAll('body > button').length, hostDisplay: getComputedStyle(host).display }; })()",
  );
  log(`スタイル隔離: shadow内 button min-width=${isolation.innerMinWidth} / light DOM の button=${isolation.outerButtonExists}個 / :host display=${isolation.hostDisplay}`);

  const shot = path.join(SHOTS, '6.4.png');
  await page.screenshot(shot);
  const diag = await page.diagnostics();
  await driver.closePage(page);
  await server.close();
  cleanupServers.splice(cleanupServers.indexOf(server), 1);

  return {
    port,
    screenshot: path.relative(ROOT, shot),
    metrics: { upgraded, afterClicks, afterAttr, afterProp, isolation },
    checks: [
      { name: 'custom element が定義される', ok: upgraded.defined === true },
      { name: 'Shadow DOM (open) が生成される', ok: upgraded.hasShadow === true && upgraded.mode === 'open' },
      { name: 'initial=10 が初期値に反映される', ok: upgraded.initial === '10' && upgraded.value === 10, detail: `shown=${upgraded.initial} value=${upgraded.value}` },
      { name: 'step=2 で +2/+2/-2 が 12→14→12 になる', ok: JSON.stringify(events) === JSON.stringify([12, 14, 12]), detail: JSON.stringify(events) },
      { name: 'change イベントが light DOM の <output> へ反映される', ok: afterClicks.log === '12', detail: afterClicks.log },
      { name: 'attributeChangedCallback で initial 変更が反映される', ok: afterAttr.shown === '100' && afterAttr.value === 100 },
      { name: 'value プロパティ書き込みが反映される', ok: afterProp.shown === '7' && afterProp.log === '7' },
      { name: ':host のスタイルが Shadow DOM 内に隔離される', ok: isolation.innerMinWidth === '32px' && isolation.hostDisplay === 'inline-flex', detail: `${isolation.innerMinWidth}/${isolation.hostDisplay}` },
      ...diagChecks(diag),
    ],
    diagnostics: diag,
  };
});

// ---------------------------------------------------------------- 9.2 Service Worker によるオフライン対応
await runExercise('9.2', 'Service Worker でオフライン対応', async (log) => {
  const port = PORTS['9.2'];
  // APP_SHELL が '/index.html' などの絶対パスなので solution/ をルートとして配信する
  const server = await serve(path.join(ROOT, 'code/ch09/pwa-service-worker/solution'), port, log);

  const page = await driver.newPage();
  await page.send('ServiceWorker.enable').catch(() => log('  [warn] ServiceWorker ドメインを有効化できません'));
  await page.navigate(`${server.origin}/index.html`);
  await sleep(400);

  // install / activate を待つ
  const ready = await page.evaluate(
    "navigator.serviceWorker.ready.then((r) => ({ scope: r.scope, active: r.active?.state, scriptURL: r.active?.scriptURL }))",
    { awaitPromise: true },
  );
  log(`serviceWorker.ready: scope=${ready.scope} state=${ready.active} script=${ready.scriptURL}`);

  await waitFor(async () => (await page.evaluate('window.__ken66.sw.join(",")')).includes('activated'), {
    timeout: 15000,
    label: 'service worker activated',
  });
  const lifecycle = await page.evaluate('JSON.parse(JSON.stringify(window.__ken66.sw))');
  log(`ライフサイクル (ページ側 statechange): ${lifecycle.join(' -> ')}`);
  const cdpStatuses = [...page.swVersions, ...driver.browserServiceWorkerEvents].map((v) => v.status);
  const seen = new Set([...cdpStatuses, ...lifecycle.map((s) => s.split(':')[1])]);
  log(`ライフサイクル (CDP ServiceWorker.workerVersionUpdated): ${cdpStatuses.join(' -> ') || '(イベントなし)'}`);
  log(`観測できた状態の集合: ${[...seen].join(', ')}`);

  const cacheState = await page.evaluate(
    "caches.open('webbook-v1').then((c) => c.keys()).then((keys) => keys.map((r) => new URL(r.url).pathname).sort())",
    { awaitPromise: true },
  );
  log(`キャッシュ webbook-v1: ${JSON.stringify(cacheState)}`);

  // Todo を1件追加して localStorage に保存
  await page.typeInto('#todo', 'オフラインでも見えるTodo');
  await page.clickElement("document.querySelector('#form button')");
  await sleep(150);
  const onlineState = await page.evaluate("({ items: document.querySelectorAll('#list li').length, status: document.querySelector('#status').textContent })");
  log(`オンライン時: Todo ${onlineState.items}件 / status="${onlineState.status}"`);

  // SW 制御下での再読込 (2回目) では registration.active が確定し status が 'offline ready' になる
  await page.navigate(`${server.origin}/index.html`);
  await sleep(400);
  const secondLoad = await page.evaluate("({ items: document.querySelectorAll('#list li').length, status: document.querySelector('#status').textContent, controlled: !!navigator.serviceWorker.controller })");
  log(`SW制御下の再読込: Todo ${secondLoad.items}件 / status="${secondLoad.status}" / controller=${secondLoad.controlled}`);

  const shotOnline = path.join(SHOTS, '9.2-online.png');
  await page.screenshot(shotOnline);

  // --- offline へ切り替えて再読み込み ---
  page.phase = 'offline';
  const targetCount = await driver.setOffline(page, true);
  log(`Network.emulateNetworkConditions(offline=true) を ${targetCount} ターゲット (page + service_worker) へ適用`);
  await sleep(200);

  await page.navigate(`${server.origin}/index.html`).catch((e) => log(`  navigate: ${e.message}`));
  await sleep(600);
  const offlineDom = await page.evaluate("({ title: document.title, h1: document.querySelector('h1')?.textContent, body: document.body.textContent.trim().slice(0, 120) })");
  log(`オフライン再読込 (CDP emulation): title="${offlineDom.title}" h1="${offlineDom.h1}"`);
  const emulationFallback = offlineDom.h1 === 'オフラインです';

  // --- 実際にサーバを落として二重確認 ---
  await driver.setOffline(page, false);
  await server.close();
  cleanupServers.splice(cleanupServers.indexOf(server), 1);
  log('検証用に HTTP サーバを停止して、真のネットワーク断でも fallback するか確認');
  await sleep(200);
  await page.navigate(`${server.origin}/index.html`).catch((e) => log(`  navigate: ${e.message}`));
  await sleep(600);
  const serverDownDom = await page.evaluate("({ title: document.title, h1: document.querySelector('h1')?.textContent })");
  log(`オフライン再読込 (サーバ停止): title="${serverDownDom.title}" h1="${serverDownDom.h1}"`);
  const serverDownFallback = serverDownDom.h1 === 'オフラインです';

  // キャッシュされた CSS がオフラインでも取れることを確認
  const cachedAssetOk = await page.evaluate(
    "caches.match('/style.css').then((r) => !!r && r.ok)",
    { awaitPromise: true },
  );
  log(`キャッシュから /style.css を取得: ${cachedAssetOk}`);

  const shot = path.join(SHOTS, '9.2.png');
  await page.screenshot(shot);

  const diag = await page.diagnostics();
  log(`offline フェーズの Network 失敗 (想定内): ${diag.networkFailuresOffline.length} 件 -> ${[...new Set(diag.networkFailuresOffline.map((f) => f.error))].join(', ')}`);
  await driver.closePage(page);

  return {
    port,
    screenshot: path.relative(ROOT, shot),
    screenshots: [path.relative(ROOT, shotOnline), path.relative(ROOT, shot)],
    metrics: {
      scope: ready.scope,
      lifecycle,
      lifecycleStatusesObserved: [...seen],
      cdpWorkerStatuses: cdpStatuses,
      cachedEntries: cacheState,
      onlineState,
      secondLoad,
      offlineFallbackByEmulation: emulationFallback,
      offlineFallbackByServerDown: serverDownFallback,
      cachedAssetOk,
      expectedOfflineNetworkFailures: diag.networkFailuresOffline.length,
    },
    checks: [
      { name: 'Service Worker が install される (installing -> installed)', ok: seen.has('installing') && seen.has('installed'), detail: [...seen].join(', ') },
      { name: 'Service Worker が activate される (activating -> activated)', ok: seen.has('activated'), detail: [...seen].join(', ') },
      { name: 'scope が / でルート配下を制御する', ok: ready.scope === `${server.origin}/`, detail: ready.scope },
      { name: 'App Shell 6件がキャッシュされる', ok: cacheState.length === 6, detail: JSON.stringify(cacheState) },
      { name: 'オンラインで Todo を追加できる', ok: onlineState.items === 1 },
      { name: '再読込後は Service Worker が制御し status が offline ready になる', ok: secondLoad.controlled === true && secondLoad.status === 'offline ready', detail: `controller=${secondLoad.controlled} status=${secondLoad.status}` },
      { name: '再読込後も localStorage の Todo が残る', ok: secondLoad.items === 1, detail: `items=${secondLoad.items}` },
      { name: 'CDP offline エミュレーションで offline.html にフォールバック', ok: emulationFallback, detail: offlineDom.h1 },
      { name: 'サーバ停止時も offline.html にフォールバック', ok: serverDownFallback, detail: serverDownDom.h1 },
      { name: 'オフラインでもキャッシュ資産を取得できる', ok: cachedAssetOk === true },
      ...diagChecks(diag),
    ],
    diagnostics: diag,
  };
});

// ---------------------------------------------------------------- 24.5 Web Vitals 計測
await runExercise('24.5', 'Web Vitals 計測スクリプト(LCP/FID/CLS)', async (log) => {
  const port = PORTS['24.5'];
  const server = await serve(path.join(ROOT, 'code/ch24'), port, log);

  const page = await driver.newPage();
  await page.navigate(`${server.origin}/web-vitals.solution.html`);
  await sleep(700);

  const initial = await page.evaluate('JSON.parse(JSON.stringify(window.__webVitals))');
  log(`初期 (LCP のみ確定): ${JSON.stringify(initial)}`);

  // 入力に依らないレイアウトシフトを起こす (hadRecentInput=false で CLS に計上される)
  await page.evaluate("document.querySelector('.shift').style.marginTop = '18rem'");
  await sleep(500);
  await page.evaluate("document.querySelector('.shift').style.marginTop = '4rem'");
  await sleep(500);
  const afterShift = await page.evaluate('JSON.parse(JSON.stringify(window.__webVitals))');
  log(`プログラム起因シフト後: CLS=${afterShift.CLS}`);

  // 実クリックで INP (event duration) を測る。ハンドラは 35ms ブロックする
  await page.clickElement("document.querySelector('#interact')");
  await sleep(400);
  await page.clickElement("document.querySelector('#interact')");
  await sleep(600);
  const afterInteract = await page.evaluate('JSON.parse(JSON.stringify(window.__webVitals))');
  log(`操作後: ${JSON.stringify(afterInteract)}`);

  // ユーザー入力直後のシフトは hadRecentInput により CLS から除外される
  const clsBeforeButtonShift = afterInteract.CLS;
  await page.clickElement("document.querySelector('#shift')");
  await sleep(500);
  const afterButtonShift = await page.evaluate('JSON.parse(JSON.stringify(window.__webVitals))');
  log(`入力直後のシフト後: CLS=${afterButtonShift.CLS} (hadRecentInput により除外され据え置きなら期待どおり)`);

  const observerVitals = await page.evaluate('JSON.parse(JSON.stringify(window.__ken66.vitals))');
  log(`検証側 Observer: ${JSON.stringify(observerVitals)}`);

  const displayed = await page.evaluate("document.querySelector('#metrics').textContent");
  log(`画面表示:\n${displayed}`);

  const shot = path.join(SHOTS, '24.5.png');
  await page.screenshot(shot);
  const diag = await page.diagnostics();
  await driver.closePage(page);
  await server.close();
  cleanupServers.splice(cleanupServers.indexOf(server), 1);

  return {
    port,
    screenshot: path.relative(ROOT, shot),
    metrics: {
      pageObserver: afterButtonShift,
      verifierObserver: observerVitals,
      lcpMs: afterButtonShift.LCP,
      inpMs: afterButtonShift.INP,
      fidMs: observerVitals.FID,
      cls: afterButtonShift.CLS,
      clsExcludedAfterInput: afterButtonShift.CLS === clsBeforeButtonShift,
    },
    checks: [
      { name: 'LCP を実測できた', ok: Number.isFinite(afterButtonShift.LCP), detail: `${afterButtonShift.LCP}ms` },
      { name: 'CLS を実測できた (>0)', ok: afterButtonShift.CLS > 0, detail: `${afterButtonShift.CLS}` },
      { name: 'INP(event duration) を実測できた', ok: Number.isFinite(afterButtonShift.INP) && afterButtonShift.INP >= 16, detail: `${afterButtonShift.INP}ms` },
      { name: 'FID(first-input delay) を実測できた', ok: Number.isFinite(observerVitals.FID), detail: `${observerVitals.FID}ms` },
      { name: '入力直後のシフトは hadRecentInput で CLS から除外される', ok: afterButtonShift.CLS === clsBeforeButtonShift, detail: `${clsBeforeButtonShift} -> ${afterButtonShift.CLS}` },
      { name: '計測値が画面に JSON で表示される', ok: displayed.includes('"LCP"') && displayed.includes('"CLS"') && displayed.includes('"INP"') },
      ...diagChecks(diag),
    ],
    diagnostics: diag,
  };
});

// ---------------------------------------------------------------- 後片付け・結果出力
for (const server of cleanupServers) await server.close().catch(() => {});
browser.close();
chrome.child.kill('SIGTERM');
await sleep(500);
if (chrome.child.exitCode === null) chrome.child.kill('SIGKILL');
await fs.rm(chrome.userDataDir, { recursive: true, force: true });

const summary = {
  issue: 'KEN-66',
  title: 'ブラウザ演習6件を手動確認する (ヘッドレス Chrome + CDP による自動代替検証)',
  executedAt: new Date().toISOString(),
  environment: {
    node: process.version,
    platform: `${process.platform} ${os.release()} ${process.arch}`,
    chrome: chrome.version.Browser,
    protocolVersion: chrome.version['Protocol-Version'],
    headless: !HEADFUL,
    automation: 'Chrome DevTools Protocol over Node built-in WebSocket (no npm dependency added)',
    network: 'localhost only (--proxy-server=http://127.0.0.1:1 により非 loopback 宛の通信を遮断。Chrome は loopback を既定でプロキシ迂回する)',
    cspHeader: 'Content-Security-Policy-Report-Only: default-src \'self\'; ... (検証サーバが付与)',
  },
  totals: {
    exercises: results.length,
    pass: results.filter((r) => r.verdict === 'PASS').length,
    fail: results.filter((r) => r.verdict === 'FAIL').length,
    totalElapsedSec: Number((results.reduce((a, r) => a + r.elapsedMs, 0) / 1000).toFixed(2)),
  },
  exercises: results.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.verdict === 'PASS' ? 'passed' : 'failed',
    verdict: r.verdict,
    port: r.port,
    elapsedSec: Number((r.elapsedMs / 1000).toFixed(2)),
    consoleErrors: r.diagnostics ? r.diagnostics.consoleErrors.length + r.diagnostics.exceptions.length + r.diagnostics.logErrors.length : null,
    consoleWarnings: r.diagnostics ? r.diagnostics.consoleWarnings.length + r.diagnostics.logWarnings.length : null,
    networkFailures: r.diagnostics ? r.diagnostics.networkFailures.length : null,
    cspViolations: r.diagnostics ? r.diagnostics.cspViolations.length : null,
    metrics: r.metrics,
    checks: r.checks.map((c) => ({ name: c.name, ok: c.ok, detail: c.detail ?? null })),
    screenshot: r.screenshot,
    screenshots: r.screenshots ?? (r.screenshot ? [r.screenshot] : []),
    log: `.verification/ken66/logs/${r.id}-verify.out`,
    additionalLogs: r.additionalLogs ?? [],
  })),
};

await fs.writeFile(path.join(ROOT, 'reports', 'data', 'ken66-browser-verification-results.json'), JSON.stringify(summary, null, 2) + '\n');
console.log('\n================ SUMMARY ================');
for (const r of summary.exercises) console.log(`${r.verdict.padEnd(4)} ${r.id.padEnd(5)} port=${r.port} ${r.elapsedSec}s  ${r.title}`);
console.log(`PASS ${summary.totals.pass} / FAIL ${summary.totals.fail}`);
process.exit(summary.totals.fail === 0 ? 0 : 1);
