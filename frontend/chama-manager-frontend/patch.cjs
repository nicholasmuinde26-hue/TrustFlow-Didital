const fs = require('fs');

const path = 'src/modules/chama/pages/MemberDashboardPage.jsx';
let content = fs.readFileSync(path, 'utf8');

const targetHeader = `<header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 p-6 sm:p-8 text-white shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 border border-white/30 px-3 py-1 text-xs font-semibold text-white">
              <Wallet className="h-3.5 w-3.5" />
              MY CHAMA
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
              Your Position at a Glance
            </h1>
            <p className="max-w-xl text-sm text-emerald-100">
              Savings, shares, loan position, and your digital membership card — all in one place.
            </p>
          </div>

          {/* Compact digital card preview, echoing Command Center's card */}
          <div className="relative overflow-hidden rounded-2xl bg-black/20 border border-white/20 backdrop-blur px-5 py-4 min-w-[220px]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] tracking-widest text-emerald-100 uppercase font-semibold">
                Member ID
              </p>
              <QrCode className="h-4 w-4 text-emerald-100" />
            </div>
            <p className="font-mono text-lg font-black tracking-wider">
              {displayMemberId}
            </p>
            <span className="mt-2 inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              {role}
            </span>
          </div>
        </div>
      </header>`;

const newHeader = `<header className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 p-5 sm:p-8 text-white shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative z-10">
          <div className="space-y-1 sm:space-y-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/20 border border-white/30 px-3 py-1 text-xs font-semibold text-white">
              <Wallet className="h-3.5 w-3.5" />
              MY CHAMA
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white hidden sm:block">
              Your Position at a Glance
            </h1>
            <div className="sm:hidden">
            <p className="text-[10px] tracking-widest text-emerald-100 uppercase font-semibold mb-1">Total Balance</p>
              <h1 className="text-3xl font-extrabold tracking-tight text-white">{money(savingsBalance)}</h1>
            </div>

            <p className="max-w-xl text-sm text-emerald-100 hidden sm:block">
              Savings, shares, loan position, and your digital membership card — all in one place.
            </p>
          </div>

          {/* Compact digital card preview */}
          <div className="relative overflow-hidden rounded-2xl bg-black/20 border border-white/20 backdrop-blur px-4 py-3 sm:px-5 sm:py-4 min-w-[220px]">
            <div className="flex items-center justify-between mb-1 sm:mb-3">
              <p className="text-[10px] tracking-widest text-emerald-100 uppercase font-semibold">
                Member ID
              </p>
              <QrCode className="h-4 w-4 text-emerald-100" />
            </div>
            <div className="flex items-center justify-between">
              <p className="font-mono text-base sm:text-lg font-black tracking-wider">
                {displayMemberId}
              </p>
              <span className="inline-block rounded-full bg-white/20 px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wide">
                {role}
              </span>
            </div>
          </div>
        </div>
      </header>`;

// Use regex replace to ignore minor whitespace differences
const regexStr = targetHeader.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&").replace(/\s+/g, "\\s+");
const regex = new RegExp(regexStr);

content = content.replace(regex, newHeader);

// Let's also compress the Bento Box grid on mobile (hide the Loan Limit on mobile if they don't have a loan? Or just make it scrollable).
// A grid of 2x2 is fine. I already did grid-cols-2.

fs.writeFileSync(path, content, 'utf8');
console.log('Done!');
