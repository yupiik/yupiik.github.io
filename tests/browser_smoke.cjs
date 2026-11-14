// Optional offline browser QA: BROWSER_BIN=/path/to/chromium node tests/browser_smoke.cjs
// Requires an installed Chromium-based browser; no npm packages or website build.
const {spawn} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const server = http.createServer((req, res) => {
    const files = {'/':'index.html', '/assets/signal.css':'assets/signal.css', '/assets/logo-dark.png':'assets/logo-dark.png', '/assets/logo-light.png':'assets/logo-light.png'};
    const file = files[req.url];
    if (!file) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : file.endsWith('.png') ? 'image/png' : 'text/html');
    res.end(fs.readFileSync(path.resolve(__dirname, '../public', file)));
});
const output = fs.mkdtempSync(path.join(os.tmpdir(), 'yupiik-ux-'));
const browser = spawn(process.env.BROWSER_BIN || '/usr/bin/brave-browser', [
    '--headless', '--no-sandbox', '--disable-gpu', '--disable-background-networking',
    '--no-first-run', '--no-default-browser-check', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    `--user-data-dir=${path.join(output, 'profile')}`, '--remote-debugging-pipe'
], {stdio:['ignore', 'ignore', 'pipe', 'pipe', 'pipe']});
let id = 0, buffer = '', errors = '';
const pending = new Map(), exceptions = [];
browser.stderr.on('data', data => { errors += data; });
function fail(error) {
    for (const request of pending.values()) request.reject(error);
    pending.clear();
}
browser.on('error', fail);
for (const pipe of [browser.stdio[3], browser.stdio[4]]) pipe.on('error', fail);
browser.stdio[4].on('data', chunk => {
    buffer += chunk.toString();
    let end;
    while ((end = buffer.indexOf('\0')) >= 0) {
        const value = buffer.slice(0, end); buffer = buffer.slice(end + 1);
        if (!value) continue;
        const message = JSON.parse(value), request = pending.get(message.id);
        if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params);
        if (request) {
            pending.delete(message.id);
            message.error ? request.reject(new Error(JSON.stringify(message.error))) : request.resolve(message.result);
        }
    }
});
function call(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
        const requestId = ++id;
        pending.set(requestId, {resolve, reject});
        browser.stdio[3].write(JSON.stringify({id:requestId, method, params, ...(sessionId ? {sessionId} : {})}) + '\0');
    });
}
const timeout = setTimeout(() => { fail(new Error('Browser QA timed out')); browser.kill(); }, 45000);
(async () => {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const portalURL = `http://127.0.0.1:${server.address().port}/`;
    const {targetId} = await call('Target.createTarget', {url:'about:blank'});
    const {sessionId} = await call('Target.attachToTarget', {targetId, flatten:true});
    const c = (method, params) => call(method, params, sessionId);
    const evaluate = async expression => {
        const response = await c('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true});
        if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
        return response.result.value;
    };
    const ready = async condition => {
        for (let attempt = 0; attempt < 100; attempt++) {
            if (await evaluate(condition)) return;
            await new Promise(resolve => setTimeout(resolve, 30));
        }
        throw new Error(`Condition not met: ${condition}`);
    };
    const key = async (key, code = key) => {
        const windowsVirtualKeyCode = {Enter:13, Tab:9, Home:36, ArrowDown:40}[key];
        await c('Input.dispatchKeyEvent', {type:'keyDown', key, code, windowsVirtualKeyCode, ...(key === 'Enter' ? {text:'\r'} : {})});
        await c('Input.dispatchKeyEvent', {type:'keyUp', key, code, windowsVirtualKeyCode});
    };
    const visible = () => evaluate("[...document.querySelectorAll('#grid article')].filter(a=>!a.hidden).length");
    const screenshot = async name => {
        await evaluate('window.scrollTo(0,0)');
        await new Promise(resolve => setTimeout(resolve, 150));
        const {cssContentSize} = await c('Page.getLayoutMetrics');
        const shot = await c('Page.captureScreenshot', {captureBeyondViewport:true, clip:{x:0,y:0,width:cssContentSize.width,height:cssContentSize.height,scale:1}});
        fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(shot.data, 'base64'));
    };
    await c('Page.enable'); await c('Runtime.enable');
    await c('Emulation.setScriptExecutionDisabled', {value:true});
    await c('Page.navigate', {url:portalURL});
    await ready('document.readyState === "complete"');
    for (const width of [320, 768, 1280]) {
        await c('Emulation.setDeviceMetricsOverride', {width, height:1000, deviceScaleFactor:1, mobile:false});
        assert(await evaluate(`document.querySelectorAll('#grid article').length===9 && [...document.querySelectorAll('#grid article')].every(a=>a.getBoundingClientRect().height>0) && document.querySelectorAll('#grid a').length===18 && getComputedStyle(document.getElementById('project-tools')).display==='none' && getComputedStyle(document.getElementById('themeToggleBtn')).display==='none' && document.documentElement.scrollWidth<=innerWidth && [...document.images].every(i=>i.complete&&i.naturalWidth>0)`), JSON.stringify(await evaluate(`({width:innerWidth, scroll:document.documentElement.scrollWidth, images:[...document.images].map(i=>({src:i.src.slice(0,80),complete:i.complete,width:i.naturalWidth})),overflow:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth).map(e=>({tag:e.tagName,cls:e.className,right:e.getBoundingClientRect().right}))})`)));
        await screenshot(`nojs-${width}`);
    }
    console.log('PASS: no-JS cards, links, local images, hidden controls and layout at 320/768/1280px');
    await c('Emulation.setScriptExecutionDisabled', {value:false});
    await c('Emulation.setEmulatedMedia', {features:[{name:'prefers-color-scheme', value:'dark'}]});
    await c('Page.reload'); await ready('document.readyState === "complete" && !document.getElementById("project-tools").hidden');
    assert.equal(await visible(), 9);
    assert.equal(await evaluate('localStorage.getItem("yupiik-theme")'), null);
    await c('Emulation.setEmulatedMedia', {features:[{name:'prefers-color-scheme', value:'light'}]});
    assert.equal(await evaluate('document.documentElement.getAttribute("data-theme")'), 'dark');
    await c('Page.reload'); await ready('document.readyState === "complete" && !document.getElementById("project-tools").hidden');
    assert.equal(await evaluate('document.documentElement.getAttribute("data-theme")'), 'dark');
    assert.equal(await evaluate('document.getElementById("theme-label").textContent'), 'Light');
    await c('Emulation.setEmulatedMedia', {features:[{name:'prefers-color-scheme', value:'dark'}]});
    assert.equal(await evaluate('document.documentElement.getAttribute("data-theme")'), 'dark');
    // Real keyboard events exercise the skip link, search, native select and reset.
    await key('Tab'); assert.equal(await evaluate('document.activeElement.className'), 'skip-link');
    await key('Enter'); assert.equal(await evaluate('document.activeElement.id'), 'content');
    await key('Tab'); assert.equal(await evaluate('document.activeElement.id'), 'project-search');
    assert(await evaluate('document.activeElement.matches(":focus-visible") && getComputedStyle(document.activeElement).outlineStyle === "solid"'));
    await c('Input.insertText', {text:'  GrAaLvM  '}); assert.equal(await visible(), 2);
    await key('Tab'); assert.equal(await evaluate('document.activeElement.id'), 'project-category');
    await key('Home'); for (let n = 0; n < 3; n++) await key('ArrowDown');
    assert.equal(await evaluate('document.getElementById("project-category").value'), 'cloud-native');
    assert.equal(await visible(), 0);
    assert(await evaluate('document.getElementById("project-results").textContent.startsWith("No projects match.")'));
    const ax = await c('Accessibility.getFullAXTree');
    assert(ax.nodes.some(n => n.role?.value === 'status' && n.properties?.some(p => p.name === 'live' && p.value.value === 'polite')));
    await key('Tab'); assert.equal(await evaluate('document.activeElement.id'), 'reset-filters');
    await key('Enter'); assert.equal(await visible(), 9); assert.equal(await evaluate('document.activeElement.id'), 'project-search');
    await evaluate('window.originalCards=[...document.querySelectorAll("#grid article")]');
    for (const [category, count] of Object.entries({'ai-agents':1, 'java-frameworks':2, 'cloud-native':2, 'data-engineering':2, 'developer-tools':2})) {
        await evaluate(`document.getElementById('project-category').value=${JSON.stringify(category)};document.getElementById('project-category').dispatchEvent(new Event('change'))`);
        assert.equal(await visible(), count);
    }
    await evaluate('document.getElementById("project-category").value="all";document.getElementById("project-search").value="hop workflows";document.getElementById("project-search").dispatchEvent(new Event("input"))');
    assert.equal(await visible(), 2);
    await evaluate('document.getElementById("project-search").value="<img src=x onerror=alert(1)>";document.getElementById("project-search").dispatchEvent(new Event("input"))');
    assert.equal(await visible(), 0);
    assert(await evaluate('window.originalCards.every((card,i)=>card===document.querySelectorAll("#grid article")[i]) && document.querySelectorAll("#grid img").length===0'));
    await evaluate('document.getElementById("reset-filters").click()');
    console.log('PASS: keyboard skip/search/category/reset, combined/multiword search, all categories, polite empty status, retained DOM nodes');
    await evaluate('document.getElementById("project-category").value="cloud-native";document.getElementById("project-category").dispatchEvent(new Event("change"));document.getElementById("reset-filters").focus()');
    await key('Tab'); assert.equal(await evaluate('document.activeElement.closest("article").id'), 'bundlebee');
    await evaluate('document.getElementById("reset-filters").click()');
    // Check both themes, including focus indicator and input border contrast.
    for (const theme of ['light', 'dark']) {
        await evaluate(`setTheme(${theme === 'light'})`);
        const ratios = await evaluate(`(() => {
            const rgb=c=>c.match(/[\\d.]+/g).map(Number);
            const background=e=>{const c=rgb(getComputedStyle(e).backgroundColor);if(c.length<4||c[3]===1)return c.slice(0,3);const base=e.parentElement?background(e.parentElement):[255,255,255];return base.map((v,i)=>c[i]*c[3]+v*(1-c[3]));};
            const luminance=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((v,c,i)=>v+c*[.2126,.7152,.0722][i],0);
            const ratio=(a,b)=>{a=luminance(a);b=luminance(b);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
            const elements=[...document.querySelectorAll('h1,h2,h3,.subtitle,.eyebrow,.micro,.meta-line,.workflow strong,.workflow div>span,.endline,.feature>p,.feature>a,.story p,.btn,.stamps,.footer span,.footer a,.desc,.category,.badge-sm,.project-links a,nav a,label,input,select,button,.search-hint,.results,footer')].filter(e=>e.getBoundingClientRect().height>0);
            const text=Math.min(...elements.map(e=>ratio(rgb(getComputedStyle(e).color),background(e))));
            const input=document.getElementById('project-search');input.focus();
            return {text,ring:ratio(rgb(getComputedStyle(input).outlineColor),background(input.parentElement)),border:ratio(rgb(getComputedStyle(input).borderColor),background(input))};
        })()`);
        assert(ratios.text >= 4.5, JSON.stringify(ratios)); assert(ratios.ring >= 3); assert(ratios.border >= 3);
        console.log(`PASS ${theme} contrast: text ${ratios.text.toFixed(2)}:1, focus ${ratios.ring.toFixed(2)}:1, input border ${ratios.border.toFixed(2)}:1`);
        for (const width of [320, 768, 1280]) {
            await c('Emulation.setDeviceMetricsOverride', {width, height:1000, deviceScaleFactor:1, mobile:false});
            assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'));
            await screenshot(`${theme}-${width}`);
        }
    }
    await c('Emulation.setDeviceMetricsOverride', {width:320, height:1000, deviceScaleFactor:1, mobile:false});
    await evaluate('document.documentElement.style.fontSize="200%"');
    await screenshot('text-200-percent-320');
    assert(await evaluate('document.documentElement.scrollWidth<=innerWidth'), JSON.stringify(await evaluate('[...document.querySelectorAll("body *")].filter(e=>e.getBoundingClientRect().right>innerWidth).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,40),right:e.getBoundingClientRect().right}))')));
    await evaluate('document.documentElement.style.fontSize=""');
    await c('Emulation.setEmulatedMedia', {features:[{name:'prefers-reduced-motion', value:'reduce'}]});
    const point = await evaluate('document.querySelector(".card").scrollIntoView(); (()=>{const r=document.querySelector(".card").getBoundingClientRect();return {x:r.x+10,y:r.y+10}})()');
    await c('Input.dispatchMouseEvent', {type:'mouseMoved', ...point});
    assert(await evaluate('getComputedStyle(document.documentElement).scrollBehavior==="auto" && getComputedStyle(document.querySelector(".card")).transitionDuration==="0s" && getComputedStyle(document.querySelector(".card")).transform==="none"'));
    await evaluate('document.getElementById("themeToggleBtn").focus()'); await key('Enter');
    const saved = await evaluate('localStorage.getItem("yupiik-theme")'); assert(saved);
    await c('Page.reload'); await ready('document.readyState === "complete" && !document.getElementById("project-tools").hidden');
    assert.equal(await evaluate('document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark"'), saved);
    assert(await evaluate(`getComputedStyle(document.querySelector('.logo-${saved}')).display !== 'none' && getComputedStyle(document.documentElement).colorScheme === '${saved}'`));
    assert.equal(saved, 'light');
    assert.equal(await evaluate('document.getElementById("theme-label").textContent'), 'Dark');
    assert.equal(await evaluate('document.getElementById("themeToggleBtn").getAttribute("aria-label")'), 'Switch to dark theme');
    await evaluate('document.getElementById("themeToggleBtn").click()');
    await c('Page.reload'); await ready('document.readyState === "complete" && !document.getElementById("project-tools").hidden');
    assert.equal(await evaluate('localStorage.getItem("yupiik-theme")'), 'dark');
    assert.equal(await evaluate('document.documentElement.dataset.theme'), 'dark');
    await evaluate('localStorage.setItem("yupiik-theme", "invalid")');
    await c('Page.reload'); await ready('document.readyState === "complete" && !document.getElementById("project-tools").hidden');
    assert.equal(await evaluate('document.documentElement.dataset.theme'), 'dark');
    await c('Page.addScriptToEvaluateOnNewDocument', {source:'Storage.prototype.getItem = Storage.prototype.setItem = () => { throw new Error("Storage blocked for QA"); };'});
    await c('Page.reload'); await ready('document.readyState === "complete" && !document.getElementById("project-tools").hidden');
    assert.equal(await evaluate('document.documentElement.dataset.theme'), 'dark');
    await evaluate('document.getElementById("themeToggleBtn").click()');
    assert.equal(await evaluate('document.documentElement.dataset.theme'), 'light');
    assert.equal(await visible(), 9);
    assert.equal(exceptions.length, 0, JSON.stringify(exceptions));
    console.log('PASS: hidden links skipped by Tab, layouts in both themes, 200% text at 320px, reduced-motion hover, dark default on light OS and OS changes, invalid preference fallback, keyboard theme toggle/labels/persistence/CSS logos, blocked storage fallback, no script exceptions');
    console.log(`Screenshots: ${output}`);
    await call('Browser.close'); clearTimeout(timeout); server.close();
})().catch(error => {console.error(error);console.error(errors.slice(-1000));console.error(`Artifacts: ${output}`);clearTimeout(timeout);browser.kill();browser.stdio[3].destroy();browser.stdio[4].destroy();browser.stderr.destroy();server.close();process.exitCode=1;});
