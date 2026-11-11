import express from 'express';
import puppeteer from 'puppeteer';

const app = express();
app.use(express.static('./'));

const server = app.listen(3000, async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  const errors = [];
  const logs = [];
  
  page.on('console', msg => {
    logs.push(`[${msg.type()}] ${msg.text()}`);
    console.log(`LOG[${msg.type()}]:`, msg.text());
  });
  page.on('pageerror', error => {
    errors.push(error.message);
    console.log('PAGE_ERROR:', error.message);
  });
  page.on('requestfailed', request => {
    console.log('REQ_FAILED:', request.url(), '-', request.failure()?.errorText);
  });
  
  await page.goto('http://localhost:3000/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 });
  await new Promise(r => setTimeout(r, 3000));
  
  // Check if app loaded
  const appState = await page.evaluate(() => {
    const screens = document.querySelectorAll('.screen');
    const active = document.querySelector('.screen.active');
    const priceGrid = document.getElementById('price-grid');
    return {
      screenCount: screens.length,
      activeScreen: active ? active.id : 'NONE',
      priceGridHTML: priceGrid ? priceGrid.innerHTML.slice(0, 100) : 'NOT FOUND',
      windowAppExists: typeof window.App !== 'undefined',
    };
  });
  
  console.log('App state:', JSON.stringify(appState, null, 2));
  console.log('Total errors:', errors.length);
  errors.forEach(e => console.log('  ERROR:', e));
  
  await browser.close();
  server.close();
});
