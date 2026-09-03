const express = require('express');
const puppeteer = require('puppeteer');

const app = express();
app.use(express.static('./'));

const server = app.listen(3000, async () => {
  console.log('Server running on 3000');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQ FAIL:', request.url(), request.failure().errorText));

  await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle2' });
  console.log('Page loaded');
  await browser.close();
  server.close();
});
