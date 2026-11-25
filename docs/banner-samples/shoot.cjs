// 배너 견본을 2배 해상도 PNG로 찍는다(알파 없음)
const { chromium } = require('C:/dotori/09_moida09/node_modules/playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 2, viewport: { width: 420, height: 700 } });
  await p.goto('file:///C:/dotori/02_ulmadna/ulmadna_v1/docs/banner-samples/banners.html');
  await p.waitForTimeout(1500);
  for (const [id, name] of [['h','AD-H_320x100'],['r','AD-R_300x250'],['p','AD-P_wallpaper_320x50'],['p2','AD-P_flooring_320x50']]) {
    await p.locator('#' + id).screenshot({ path: `C:/dotori/02_ulmadna/ulmadna_v1/docs/banner-samples/${name}@2x.png` });
  }
  await b.close(); console.log('ok');
})();
