// Staged visual audit: this does not test travel, a complete playthrough, or GPU hardware.
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createGame, applyAction, stepGame, normalizeGame, hashState } from '../src/simulation/index.ts';

const root = process.cwd(), dist = path.join(root, 'dist');
const out = path.join(root, 'docs/demo/fixture-captures');
const reportPath = path.join(root, 'docs/demo/VISUAL_FIXTURE_REPORT.json');
const saveKey = 'astra-independent-demo-v4';
const quality = process.env.ASTRA_E2E_QUALITY || 'low';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const report = { kind: 'staged_visual_fixture_audit', status: 'running', warning: 'Staged saves and camera placement; no navigation, full E2E, hardware GPU or performance acceptance is implied.', startedAt: new Date().toISOString(), commit: null, node: process.version, os: `${os.platform()} ${os.release()} ${os.arch()}`, quality, browser: null, renderer: null, fixtures: [], checks: [], errors: [], screenshots: [] };
let proc, server, profile, cdp;
function saveReport() { report.finishedAt = new Date().toISOString(); fs.mkdirSync(path.dirname(reportPath), { recursive: true }); fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n'); }
function check(name, passed, detail) { report.checks.push({ name, passed: !!passed, detail }); if (!passed) report.status = 'failed'; }
function action(s, name, payload) { const r = applyAction(s, name, payload); if (!r.ok) throw new Error(`Fixture action ${name}: ${r.message}`); return r.state; }
function makeFixtures() {
  let s = createGame({ seed: 42 });
  const academy = structuredClone(s);
  const lowReserve = stepGame(createGame({ seed: 42 }), 26);
  if (!(lowReserve.academyBattery > 0 && lowReserve.academyBattery <= 1.5 && lowReserve.phase === 'academy')) throw new Error('Low-reserve fixture was not reached safely.');
  s = action(s, 'diagnoseAcademy'); s = action(s, 'shedLoad'); s = stepGame(s, 16);
  s = action(s, 'finishAcademy'); s = action(s, 'collectCargo'); s = action(s, 'land');
  const habitat = structuredClone(s);
  for (const a of ['repairPower', 'repairWater', 'repairOxygen']) { s = action(s, a); s = stepGame(s, 5); }
  s = action(s, 'chooseLoadout');
  const sheltered = action(s, 'shelter');
  s = action(s, 'launchExpedition');
  s = action(s, 'repairCompanion'); s = stepGame(s, 5); s = action(s, 'recruitCompanion');
  const canyon = structuredClone(s);
  s = action(s, 'returnExpedition'); s = action(s, 'travel', { region: 'greenhouse' });
  s = action(s, 'plantCrop'); s = stepGame(s, 180); s = action(s, 'harvest');
  const greenhouse = structuredClone(s);
  const all = { academy, habitat, canyon, greenhouse, sheltered, lowReserve };
  for (const [name, state] of Object.entries(all)) { normalizeGame(state); report.fixtures.push({ name, simulationHash: hashState(state), phase: state.phase, region: state.region, tick: state.tick, production: 'createGame/applyAction/stepGame; no direct simulation resource edits' }); }
  return all;
}
function fileFor(state, pos) {
  // Pose is intentionally staged for composition. Simulation state comes solely from actions above.
  const c = { enabled: state.cometa.enabled, region: state.cometa.region, safePos: state.cometa.safePos, heading: state.cometa.heading, mode: state.cometa.mode, targetId: state.cometa.safeTargetId };
  const snap = { simulation: state, pose: { region: state.region, position: pos, heading: 0 }, cometa: c };
  return { version: 4, current: snap, checkpoint: structuredClone(snap), settings: { quality, reducedMotion: false, largeText: false, speed: 1 }, cadetAppearance: { suitAccent: 'orange', visorTone: 'gold', skinTone: 'medium' }, cometa: c, uiPrefs: { captionsAlwaysOn: true, dialogueAutoAdvance: false, showControlHints: true, compactHud: false } };
}
function browserPath() {
  const names = process.platform === 'win32' ? ['chrome.exe', 'msedge.exe'] : ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable'];
  const candidates = [process.env.ASTRA_CHROME_PATH, ...(process.env.PATH || '').split(path.delimiter).flatMap(d => names.map(n => path.join(d, n)))].filter(Boolean);
  for (const p of candidates) { try { fs.accessSync(p, fs.constants.X_OK); if (fs.statSync(p).isFile()) return p; } catch {} }
  throw new Error('Installed Chromium not found; set ASTRA_CHROME_PATH. No download is performed.');
}
async function serve() {
  if (!fs.existsSync(path.join(dist, 'index.html'))) throw new Error('dist/index.html missing; run npm run build first.');
  const mime = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.glb':'model/gltf-binary', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.woff2':'font/woff2' };
  server = http.createServer((req, res) => {
    if ((req.url || '').split('?')[0] === '/__fixture_storage__.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end('<!doctype html><html><head><link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E"><title>Fixture storage</title></head><body></body></html>');
      return;
    }
    try { const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '') || 'index.html'; const f = path.resolve(dist, rel);
      if ((!f.startsWith(dist + path.sep) && f !== dist) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': mime[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
    } catch { res.writeHead(400); res.end(); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return `http://127.0.0.1:${server.address().port}/`;
}
function connect(url, onEvent = () => {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url); let id = 0; const pending = new Map();
    const timer = setTimeout(() => { ws.close(); reject(new Error('CDP connect timeout')); }, 15000);
    ws.onopen = () => { clearTimeout(timer); resolve({ send(method, params = {}) { return new Promise((res, rej) => { const n = ++id; const t = setTimeout(() => { pending.delete(n); rej(new Error(`CDP timeout ${method}`)); }, 60000); pending.set(n, { res, rej, t }); ws.send(JSON.stringify({ id: n, method, params })); }); }, close() { ws.close(); } }); };
    ws.onerror = e => { clearTimeout(timer); reject(new Error(`CDP socket error ${e.type}`)); };
    ws.onmessage = e => { const m = JSON.parse(String(e.data)); if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); clearTimeout(p.t); m.error ? p.rej(new Error(`${m.error.message}`)) : p.res(m.result); } else if (!m.id) onEvent(m); };
  });
}
async function launch(exe) {
  profile = fs.mkdtempSync(path.join(os.tmpdir(), 'astra-fixture-'));
  const args = ['--headless=new','--enable-webgl','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','about:blank'];
  report.browser = { executable: exe, args, sandboxBypass: false };
  proc = spawn(exe, args, { stdio: ['ignore', 'ignore', 'pipe'] }); let stderr = '', spawnError; proc.stderr.on('data', d => { stderr += d; }); proc.on('error', e => { spawnError = e; });
  const f = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 150; i++) { if (fs.existsSync(f)) { const [port, ws] = fs.readFileSync(f, 'utf8').trim().split(/\r?\n/); if (port && ws) return { port, browser: await connect(`ws://127.0.0.1:${port}${ws}`) }; } if (proc.exitCode !== null || spawnError) break; await sleep(100); }
  throw new Error(`Chromium launch failed (sandbox preserved): ${spawnError?.message || stderr.slice(0, 1500)}`);
}
async function evaluate(expression) { const v = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (v.exceptionDetails) throw new Error(v.exceptionDetails.exception?.description || v.exceptionDetails.text); return v.result?.value; }
async function wait(expression, timeout = 45000) { const start = Date.now(); while (Date.now() - start < timeout) { try { const v = await evaluate(expression); if (v) return v; } catch {} await sleep(250); } throw new Error(`Timed out waiting for ${expression}`); }
async function navigate(url) { await cdp.send('Page.navigate', { url }); }
async function click(selector) {
  const r = await wait(`(() => { const e = document.querySelector(${JSON.stringify(selector)}); if (!e) return null; const r=e.getBoundingClientRect(); return r.width && r.height ? {x:r.left+r.width/2,y:r.top+r.height/2} : null; })()`, 12000);
  await cdp.send('Input.dispatchMouseEvent', { type:'mouseMoved', ...r });
  await cdp.send('Input.dispatchMouseEvent', { type:'mousePressed', ...r, button:'left', clickCount:1 });
  await cdp.send('Input.dispatchMouseEvent', { type:'mouseReleased', ...r, button:'left', clickCount:1 });
}
async function ready() { await wait(`document.getElementById('loading')?.hidden && window.__ASTRA_WORLD_DEBUG__`, 60000); }
async function loadFixture(base, state, pos) {
  await navigate(`${base}__fixture_storage__.html`); await wait(`location.pathname === '/__fixture_storage__.html'`);
  const payload = fileFor(state, pos);
  await evaluate(`localStorage.clear(); localStorage.setItem(${JSON.stringify(saveKey)}, ${JSON.stringify(JSON.stringify(payload))}); true`);
  await navigate(base); await ready();
  await click('[data-testid="btn-start-resume"]');
  await wait(`document.getElementById('modal-layer')?.hidden && window.__ASTRA_WORLD_DEBUG__?.getSnapshot()?.region === ${JSON.stringify(state.region)}`, 60000);
  await evaluate(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))`);
}
async function auditResourceHud(viewport) {
  const result = await evaluate(`(() => {
    const container = document.querySelector('#resources');
    const cards = Array.from(container?.querySelectorAll('.resource') || []);
    const rect = r => ({left:r.left, top:r.top, right:r.right, bottom:r.bottom, width:r.width, height:r.height});
    return { viewport: { width:innerWidth, height:innerHeight }, cards:cards.map(card => {
      const m=card.querySelector('[role="meter"]'), track=m?.getBoundingClientRect(), fill=m?.firstElementChild?.getBoundingClientRect(), r=card.getBoundingClientRect();
      return { text:card.innerText, card:rect(r), track:track&&rect(track), fill:fill&&rect(fill),
        label:m?.getAttribute('aria-label'), min:m?.getAttribute('aria-valuemin'), max:m?.getAttribute('aria-valuemax'),
        now:m?.getAttribute('aria-valuenow'), exact:m?.getAttribute('aria-valuetext'), title:card.getAttribute('title'),
        scrollWidth:card.scrollWidth, clientWidth:card.clientWidth, scrollHeight:card.scrollHeight, clientHeight:card.clientHeight };
    }) };
  })()`);
  const cards = result.cards;
  check(`hud-${viewport}-four-accessible-meters`, cards.length === 4 && ['O₂','ENERGIA','ÁGUA','ALIMENTO'].every(label => cards.some(c => c.label === label)), result);
  check(`hud-${viewport}-no-visible-amounts`, cards.length === 4 && cards.every(c => !/\d|\bkg\b|kwh/i.test(c.text.replaceAll('O₂',''))), cards.map(c => c.text));
  check(`hud-${viewport}-exact-accessible-values-and-filled-tracks`, cards.length === 4 && cards.every(c => {
    const min = Number(c.min), max = Number(c.max), now = Number(c.now), exactMatch = c.exact?.match(/: ([\d.eE+-]+) (kg|kWh);/);
    const exact = exactMatch ? Number(exactMatch[1]) : NaN;
    return Number.isFinite(exact) && c.title === c.exact && Number.isFinite(now) && max > min && now >= min && now <= max &&
      Math.abs(now - Math.max(min, Math.min(max, exact))) < 1e-7 && c.track?.width > 0 && c.track?.height > 0 && c.fill?.width > 0 &&
      Math.abs(c.fill.width / c.track.width - (now-min)/(max-min)) < 0.03;
  }), cards);
  check(`hud-${viewport}-cards-not-clipped`, cards.length === 4 && cards.every(c => c.card.width > 0 && c.card.height > 0 && c.card.left >= -1 && c.card.right <= result.viewport.width + 1 && c.card.top >= -1 && c.card.bottom <= result.viewport.height + 1 && c.scrollWidth <= c.clientWidth + 1 && c.scrollHeight <= c.clientHeight + 1) && cards.every((a,i) => cards.slice(i+1).every(b => a.card.right <= b.card.left + 1 || b.card.right <= a.card.left + 1 || a.card.bottom <= b.card.top + 1 || b.card.bottom <= a.card.top + 1)), result);
}
async function capture(name, fixture, description) {
  const snap = await evaluate(`(() => { const s=window.__ASTRA_WORLD_DEBUG__.getSnapshot(); const c=document.getElementById('world'); return {region:s.region, position:s.actors.astronaut.position, cometa:s.cometa, canvas:{width:c.width,height:c.height}, metrics:s.metrics}; })()`);
  const { data } = await cdp.send('Page.captureScreenshot', { format:'png' });
  fs.mkdirSync(out, { recursive:true }); const filename = `fixture-${name}.png`; fs.writeFileSync(path.join(out, filename), Buffer.from(data, 'base64'));
  report.screenshots.push({ file: `docs/demo/fixture-captures/${filename}`, fixture, description, snapshot: snap });
}
async function run() {
  if (!['high','low'].includes(quality)) throw new Error('ASTRA_E2E_QUALITY must be high or low');
  report.commit = execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
  report.distIndexSha256 = createHash('sha256').update(fs.readFileSync(path.join(dist,'index.html'))).digest('hex');
  const fixtures = makeFixtures(), base = await serve(), ctx = await launch(browserPath());
  const version = await ctx.browser.send('Browser.getVersion'); Object.assign(report.browser, { product:version.product, userAgent:version.userAgent });
  const { targetId } = await ctx.browser.send('Target.createTarget', { url:'about:blank' });
  const pages = await fetch(`http://127.0.0.1:${ctx.port}/json/list`).then(r => r.json());
  const errors = { exceptions:[], consoleErrors:[], http:[], network:[] };
  cdp = await connect(pages.find(p => p.id === targetId).webSocketDebuggerUrl, m => {
    if (m.method === 'Runtime.exceptionThrown') errors.exceptions.push(m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.consoleErrors.push(m.params.args.map(a => a.value ?? a.description ?? '').join(' '));
    if (m.method === 'Network.responseReceived' && m.params.response.status >= 400) errors.http.push({ url:m.params.response.url, status:m.params.response.status });
    if (m.method === 'Network.loadingFailed' && !m.params.canceled) errors.network.push(m.params.errorText);
  });
  await cdp.send('Page.enable'); await cdp.send('Runtime.enable'); await cdp.send('Network.enable'); await cdp.send('Page.bringToFront');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width:1280, height:800, deviceScaleFactor:1, mobile:false });
  await navigate(`${base}__fixture_storage__.html`); await wait(`location.pathname === '/__fixture_storage__.html'`); await evaluate('localStorage.clear(); true');
  await navigate(base); await ready();
  report.renderer = await evaluate(`(() => { const gl=document.createElement('canvas').getContext('webgl2'); const d=gl?.getExtension('WEBGL_debug_renderer_info'); return {webgl2:!!gl, unmaskedRenderer:gl&&d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):null, unmaskedVendor:gl&&d?gl.getParameter(d.UNMASKED_VENDOR_WEBGL):null}; })()`);
  await cdp.send('Page.reload', { ignoreCache:true }); await ready();
  check('pre-start-pagehide-no-save', await evaluate(`localStorage.getItem(${JSON.stringify(saveKey)}) === null`), 'Reloaded unstarted page through browser navigation.');
  check('pre-start-no-reserve-alarm', await evaluate(`!document.getElementById('hud')?.classList.contains('reserves-low') && !document.querySelector('[data-testid="cometa-resource-reminder"]')`), 'No active-game warning before expedition begins.');
  const favicon = await evaluate(`(async () => { const link=document.querySelector('link[rel~="icon"]'); const url=link?.href || new URL('/favicon.ico', location.href).href; const r=await fetch(url); return {url,status:r.status}; })()`);
  check('favicon-available', favicon.status === 200, favicon);
  await loadFixture(base, fixtures.academy, {x:0,y:0,z:-10}); await auditResourceHud('desktop'); await capture('01-academy', 'academy', 'Academy and Cometa, staged pose.');
  await loadFixture(base, fixtures.habitat, {x:0,y:0,z:-14}); await capture('02-habitat', 'habitat', 'Habitat on arrival, staged pose.');
  await loadFixture(base, fixtures.habitat, {x:0,y:0,z:-6}); await capture('03-habitat-crew', 'habitat', 'Habitat crew closer to console, staged pose.');
  await loadFixture(base, fixtures.canyon, {x:5,y:0,z:4}); await capture('04-canyon', 'canyon', 'Canyon after Scout repair, staged pose.');
  await loadFixture(base, fixtures.greenhouse, {x:0,y:0,z:-5}); await capture('05-greenhouse', 'greenhouse', 'Greenhouse after simulated crop growth and harvest, staged pose.');
  await loadFixture(base, fixtures.academy, {x:0,y:0,z:-10});
  await cdp.send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:2,mobile:true}); await cdp.send('Emulation.setTouchEmulationEnabled', {enabled:true,maxTouchPoints:5});
  await sleep(500); await auditResourceHud('mobile'); await capture('06-mobile', 'academy', 'Mobile viewport, staged academy pose.');
  await cdp.send('Emulation.setDeviceMetricsOverride', {width:1280,height:800,deviceScaleFactor:1,mobile:false}); await cdp.send('Emulation.setTouchEmulationEnabled', {enabled:false});
  await loadFixture(base, fixtures.lowReserve, {x:0,y:0,z:-10});
  const low = await wait(`(() => { const h=document.getElementById('hud'); const reminder=document.querySelector('[data-testid="cometa-resource-reminder"]'); return h?.classList.contains('reserves-low') && reminder?.textContent ? { alarm:true, reminder:reminder.textContent, energy:document.querySelector('[aria-label="ENERGIA"]')?.getAttribute('aria-valuetext') } : null; })()`, 10000).catch(() => null);
  check('low-reserve-hud-and-cometa-reminder', Boolean(low?.alarm && /energia/i.test(low.reminder)), low);
  await capture('07-resource-alert', 'lowReserve', 'Low academy battery created by 26 simulated ticks; staged position.');
  await click('[data-testid="cometa-toggle"]');
  const pipFallback = await wait(`(() => { const pip=document.getElementById('pip')?.textContent || ''; return /energia está baixa/i.test(pip) && !document.querySelector('[data-testid="cometa-resource-reminder"]') ? pip : null; })()`, 10000).catch(() => null);
  check('low-reserve-pip-fallback-after-cometa-disabled', Boolean(pipFallback), pipFallback);
  await loadFixture(base, fixtures.sheltered, {x:9,y:0,z:1});
  const sheltered = await evaluate(`(() => ({ snap:window.__ASTRA_WORLD_DEBUG__.getSnapshot().cometa, exit:!!document.querySelector('[data-testid="btn-exit-shelter"]') }))()`);
  check('shelter-cometa-pressurized-visible', sheltered.exit && sheltered.snap.enabled && sheltered.snap.pressurized, sheltered);
  await click('[data-testid="btn-companions"]');
  const before = await evaluate(`document.querySelector('[data-testid="modal-cometa-sniff"]')?.textContent || ''`);
  await click('[data-testid="modal-cometa-sniff"]');
  const after = await evaluate(`document.querySelector('[data-testid="modal-cometa-sniff"]')?.textContent || ''`);
  check('shelter-cometa-sniff-ui', before.includes('pressurizado') && after.includes('pressurizado'), {before,after, note:'UI availability only; this check does not assert counter or physics.'});
  report.knownIssues = ['Canyon target label can still say Scout avariado after the Scout is recruited; observed in a staged screenshot, not verified by a dedicated assertion.'];
  report.errors = errors; check('no-uncaught-errors-or-http-failures', !errors.exceptions.length && !errors.consoleErrors.length && !errors.http.length && !errors.network.length, errors);
  check('seven-staged-captures', report.screenshots.length === 7, report.screenshots.map(s => s.file));
  if (report.status !== 'failed') report.status = 'passed';
  await ctx.browser.send('Browser.close').catch(() => {});
}
const watchdog = setTimeout(() => { report.status = 'failed'; report.errors.push('20-minute deadline exceeded'); saveReport(); try { proc?.kill(); } catch {} process.exit(1); }, 20*60*1000);
try { await run(); } catch (e) { report.status = 'failed'; report.errors = Array.isArray(report.errors) ? [...report.errors, String(e.stack || e)] : { ...report.errors, fatal: String(e.stack || e) }; console.error('[fixture] audit failed:', e); process.exitCode = 1; }
finally { clearTimeout(watchdog); if (proc && proc.exitCode === null) proc.kill(); server?.close(); cdp?.close(); if (profile) { try { fs.rmSync(profile,{recursive:true,force:true}); } catch {} } saveReport(); if (report.status !== 'passed') process.exitCode = 1; }
