const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  
  await page.goto('http://localhost:8000/');
  await new Promise(r => setTimeout(r, 1000));
  
  const hasEdit = await page.evaluate(() => {
    const el = document.querySelector('.edit-toggle');
    if (!el) return 'NOT_FOUND';
    const style = window.getComputedStyle(el);
    return {
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      bottom: style.bottom,
      right: style.right
    };
  });
  console.log("EDIT BUTTON:", hasEdit);
  
  await browser.close();
})();
