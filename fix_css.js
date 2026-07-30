const fs = require('fs');

let content = fs.readFileSync('assets/styles/main.css', 'utf8');
// Remove null bytes and corrupted characters
content = content.replace(/\0/g, '').replace(/\r\n/g, '\n');

// Find the end of the @supports block (the very last clean block)
const cutoff = content.lastIndexOf('@supports (padding-bottom');
const blockEnd = content.indexOf('\n}', cutoff) + 2;
const clean = content.slice(0, blockEnd);

const walletCSS = `

/* ===== WALLET SCREEN ===== */

.wallet-summary-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 0 16px 20px;
}

.wallet-summary-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 18px 14px;
  text-align: center;
  position: relative;
  overflow: hidden;
}

.wallet-summary-card.total { border-color: rgba(245,158,11,0.35); }
.wallet-summary-card.free  { border-color: rgba(34,197,94,0.35); }

.ws-icon { font-size: 22px; display: block; margin-bottom: 6px; }
.ws-label {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-muted);
  letter-spacing: 0.5px;
  margin-bottom: 6px;
  text-transform: uppercase;
}
.ws-amount {
  font-size: 20px;
  font-weight: 900;
  line-height: 1.1;
}
.ws-amount.amber { color: var(--primary); }
.ws-amount.green { color: var(--success); }
.ws-unit { font-size: 10px; color: var(--text-muted); margin-top: 4px; }

.wallet-envelopes {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-bottom: 8px;
}

.env-card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: transform var(--t-fast);
}
.env-card:active { transform: scale(0.985); }

.env-card-top {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
}

.env-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

.env-card-body { flex: 1; min-width: 0; }
.env-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 4px;
}
.env-balance-row { display: flex; align-items: baseline; gap: 5px; }
.env-balance { font-size: 22px; font-weight: 900; color: var(--primary); }
.env-currency { font-size: 11px; color: var(--text-muted); font-weight: 600; }

.env-progress-bar {
  height: 3px;
  background: var(--border);
  margin: 0 16px;
}
.env-progress-fill {
  height: 100%;
  border-radius: 99px;
  background: linear-gradient(90deg, var(--primary-dark), var(--primary));
  transition: width 0.4s ease;
}

.env-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-top: 1px solid var(--border);
  margin-top: 12px;
}
.env-action-btn {
  background: none;
  border: none;
  padding: 13px 8px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: background var(--t-fast);
}
.env-action-btn:active { background: rgba(255,255,255,0.04); }
.env-action-btn:first-child { border-left: 1px solid var(--border); }
.env-action-btn.deposit { color: var(--success); }
.env-action-btn.spend   { color: var(--danger); }

.add-env-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 15px;
  background: none;
  border: 2px dashed var(--border);
  border-radius: var(--radius-lg);
  color: var(--text-muted);
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all var(--t-fast);
  margin-bottom: 24px;
}
.add-env-btn:active { border-color: var(--primary); color: var(--primary); }

.small-btn {
  background: var(--primary-glow);
  color: var(--primary);
  border: none;
  padding: 6px 14px;
  border-radius: 20px;
  font-family: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
`;

fs.writeFileSync('assets/styles/main.css', clean + walletCSS, 'utf8');
console.log('Done. Total lines: ' + (clean + walletCSS).split('\n').length);
