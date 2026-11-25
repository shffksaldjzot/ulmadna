// 고급형 배너 견본을 2배 PNG로
const { chromium } = require('C:/dotori/09_moida09/node_modules/playwright');
(async () => { const b = await chromium.launch(); const p = await b.newPage({ deviceScaleFactor: 2, viewport: { width: 400, height: 320 } });
  await p.goto('file:///C:/dotori/02_ulmadna/ulmadna_v1/docs/banner-samples/premium.html'); await p.waitForTimeout(1800);
  await p.locator('#r').screenshot({ path: 'C:/dotori/02_ulmadna/ulmadna_v1/docs/banner-samples/AD-R_premium_300x250@2x.png' }); await b.close(); console.log('ok'); })();
