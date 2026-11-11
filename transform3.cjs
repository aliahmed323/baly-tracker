const fs = require('fs');
let walletJs = fs.readFileSync('src/modules/wallet.js', 'utf8');

// Replace the getStats function body
walletJs = walletJs.replace(/async getStats\(\) \{[\s\S]*?async getHomeExpenses/m, `async getStats() {
    const [taxiStats, envelopes, txs, allBalySnaps, allTransfers, cashAdj, zainAdj, zainTxs] = await Promise.all([
      Reports.getAllTimeStats(),
      this.getEnvelopes(),
      Database.getAllWalletTransactions(),
      BalyBalance.getAll(),
      Database.getAllTransfers(),
      Settings.get(KEYS.CASH_ADJUST),
      Settings.get(KEYS.ZAIN_ADJUST),
      Database.getAllZainTransactions()
    ]);

    const allTransfersSum = allTransfers.reduce((s, t) => s + (t.amount || 0), 0);
    const adjustedNetProfit = (taxiStats.netProfit || 0);
    const cashInHand = (taxiStats.cashInHand || 0) + (cashAdj || 0);

    // ── رصيد بلي ──
    const latestBalySnap = allBalySnaps.length > 0
      ? allBalySnaps.sort((a, b) => b.timestamp - a.timestamp)[0]
      : null;
    const balyBalance = latestBalySnap !== null
      ? (latestBalySnap.balance || 0)
      : ((taxiStats.appBalance || 0) + allTransfersSum);

    // ── رصيد زين كاش ──
    const baseZainCash = adjustedNetProfit - (taxiStats.cashInHand || 0) - balyBalance;
    const txSum = zainTxs.reduce((s, tx) => {
      if (tx.type === 'credit') return s + (tx.amount || 0);
      if (tx.type === 'debit')  return s - (tx.amount || 0);
      return s;
    }, 0);
    const zainCashBalance = baseZainCash + (zainAdj || 0) + txSum;

    // ── صناديق الأموال ──
    const totalInEnvelopes = envelopes.reduce((s, e) => s + (e.balance || 0), 0);
    const totalWalletExpenses = txs.filter(t => t.type === 'envelope_expense').reduce((s, t) => s + t.amount, 0);
    const currentPhysicalCash = cashInHand - totalWalletExpenses;
    const unallocated = currentPhysicalCash - totalInEnvelopes;

    return {
      netProfit:          adjustedNetProfit,
      appBalance:         balyBalance,
      balyBalance,
      cashInHand,
      zainCashBalance,
      totalInEnvelopes,
      unallocated,
      currentPhysicalCash,
      envelopes,
      totalTaxiCash:      adjustedNetProfit,
      totalExpenses:      taxiStats.totalExpenses || 0,
      totalTransfers:     allTransfersSum,
      latestDailyBalance: null,
      hasBalySnapshot:    latestBalySnap !== null,
    };
  },

  async getHomeExpenses`);

fs.writeFileSync('src/modules/wallet.js', walletJs);
console.log('Cleaned up wallet.js');
