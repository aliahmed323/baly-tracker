const fs = require('fs');

// --- APP.JS ---
let appJs = fs.readFileSync('src/app.js', 'utf8');

appJs = appJs.replace(/checkMorningGateway\(\);/g, '');
appJs = appJs.replace(/setTimeout\(\(\) => checkMorningGateway\(\), \d+\);/g, '');
appJs = appJs.replace(/openMorningGateway:\s*\(\)\s*=>\s*checkMorningGateway\(\),/g, '');
appJs = appJs.replace(/saveMorningGateway:\s*saveMorningGateway,/g, '');
appJs = appJs.replace(/skipMorningGateway:\s*\(\)\s*=>\s*closeModal\('morning-gateway'\),/g, '');

// Completely remove the functions checkMorningGateway and saveMorningGateway
// We'll just do a regex that finds them.
appJs = appJs.replace(/async function checkMorningGateway\(\) \{[\s\S]*?async function saveMorningGateway\(\) \{[\s\S]*?async function getAppVersion/m, 'async function getAppVersion');

fs.writeFileSync('src/app.js', appJs);

// --- INDEX.HTML ---
let indexHtml = fs.readFileSync('index.html', 'utf8');

// Remove the modal
indexHtml = indexHtml.replace(/<!-- ══ بوابة الصباح 🌅 ══ -->[\s\S]*?<!-- ══ محفظة زين كاش الكاملة 💚 ══ -->/m, '<!-- ══ محفظة زين كاش الكاملة 💚 ══ -->');

// Remove the button from header if exists
indexHtml = indexHtml.replace(/<button class="gw-btn" onclick="App.openMorningGateway\(\)">.*?<\/button>/g, '');

fs.writeFileSync('index.html', indexHtml);
console.log('Done removing morning gateway');
