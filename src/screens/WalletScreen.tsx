import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ArrowLeft,
  Coins,
  ShieldCheck,
  CreditCard,
  ChevronRight,
  CheckCircle2,
  History,
  Sparkles,
  ArrowDownLeft,
  ArrowUpRight,
  Repeat,
  AlertCircle,
  Building2,
  Lock,
  Wallet,
  Zap,
  Info,
  Clock,
  DollarSign,
  Smartphone,
} from 'lucide-react';

export const WalletScreen: React.FC = () => {
  const {
    coins,
    diamonds,
    transactions,
    rechargeCoins,
    withdrawDiamonds,
    exchangeDiamondsToCoins,
    navigateBack,
    setCurrentScreen,
    agencyProfile,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'recharge' | 'withdraw' | 'exchange' | 'history'>('recharge');
  const [historyFilter, setHistoryFilter] = useState<'all' | 'recharge' | 'withdrawal' | 'reward' | 'gift_received'>('all');

  // Recharge state
  const [selectedPackage, setSelectedPackage] = useState<{ coins: number; price: number; bonus: number; popular?: boolean; bestValue?: boolean }>({
    coins: 1000,
    price: 9.99,
    bonus: 100,
    popular: true,
  });
  const [paymentMethod, setPaymentMethod] = useState<'ApplePay' | 'GooglePay' | 'JazzCash' | 'EasyPaisa' | 'Card'>('JazzCash');
  const [isProcessingRecharge, setIsProcessingRecharge] = useState(false);

  // Withdrawal state
  const [withdrawAmountUSD, setWithdrawAmountUSD] = useState<number>(10);
  const [withdrawMethod, setWithdrawMethod] = useState<'JazzCash' | 'EasyPaisa' | 'Bank' | 'USDT'>('JazzCash');
  const [accountTitle, setAccountTitle] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [bankName, setBankName] = useState('Meezan Bank');
  const [isProcessingWithdraw, setIsProcessingWithdraw] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);

  // Exchange Diamonds to Coins state
  const [exchangeAmount, setExchangeAmount] = useState<number>(10000);
  const [isProcessingExchange, setIsProcessingExchange] = useState(false);
  const [exchangeFeedback, setExchangeFeedback] = useState<{ message: string; isError: boolean } | null>(null);

  // Global toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const coinPackages = [
    { coins: 100, price: 0.99, bonus: 0 },
    { coins: 500, price: 4.99, bonus: 35 },
    { coins: 1000, price: 9.99, bonus: 100, popular: true },
    { coins: 3000, price: 29.99, bonus: 450 },
    { coins: 10000, price: 99.99, bonus: 2000, bestValue: true },
    { coins: 30000, price: 299.99, bonus: 7500 },
  ];

  // Rate: 10,000 Diamonds = $1.00 USD
  const diamondsUSDValue = (diamonds / 10000).toFixed(2);
  const minWithdrawalDiamonds = 100000; // $10 = 100,000 Diamonds
  const isEligibleForWithdraw = diamonds >= minWithdrawalDiamonds;
  const diamondsNeededForChosenUSD = Math.round(withdrawAmountUSD * 10000);

  // Recharge Handler
  const handleCheckout = async () => {
    setIsProcessingRecharge(true);
    const success = await rechargeCoins(
      selectedPackage.coins + selectedPackage.bonus,
      selectedPackage.price,
      paymentMethod
    );
    setIsProcessingRecharge(false);
    if (success) {
      showToast(
        `Added ${(selectedPackage.coins + selectedPackage.bonus).toLocaleString()} Coins to your wallet!`
      );
    }
  };

  // Withdraw Handler
  const handleSubmitWithdrawal = (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawError(null);
    setWithdrawSuccess(null);

    if (withdrawAmountUSD < 10) {
      setWithdrawError('Minimum withdrawal amount is $10.00 USD (100,000 Diamonds).');
      return;
    }

    if (diamonds < diamondsNeededForChosenUSD) {
      setWithdrawError(
        `Insufficient diamonds! You need ${diamondsNeededForChosenUSD.toLocaleString()} Diamonds for a $${withdrawAmountUSD.toFixed(2)} withdrawal.`
      );
      return;
    }

    if (!accountTitle.trim()) {
      setWithdrawError('Please enter your Account Title / Beneficiary Name.');
      return;
    }

    if (!accountNumber.trim()) {
      setWithdrawError('Please enter your Account Number / IBAN / Wallet Address.');
      return;
    }

    setIsProcessingWithdraw(true);
    setTimeout(() => {
      const res = withdrawDiamonds(withdrawAmountUSD, withdrawMethod, {
        title: accountTitle.trim(),
        number: accountNumber.trim(),
        bankName: withdrawMethod === 'Bank' ? bankName : undefined,
      });

      setIsProcessingWithdraw(false);
      if (res.success) {
        setWithdrawSuccess(res.message);
        setAccountTitle('');
        setAccountNumber('');
        showToast(`Withdrawal of $${withdrawAmountUSD.toFixed(2)} submitted successfully!`);
      } else {
        setWithdrawError(res.message);
      }
    }, 600);
  };

  // Exchange Diamonds to Coins Handler
  const handleExecuteExchange = () => {
    setExchangeFeedback(null);
    if (exchangeAmount <= 0) {
      setExchangeFeedback({ message: 'Please enter a valid amount of diamonds', isError: true });
      return;
    }
    if (diamonds < exchangeAmount) {
      setExchangeFeedback({ message: 'Insufficient diamonds balance for this exchange', isError: true });
      return;
    }

    setIsProcessingExchange(true);
    setTimeout(() => {
      const res = exchangeDiamondsToCoins(exchangeAmount);
      setIsProcessingExchange(false);
      if (res.success) {
        setExchangeFeedback({ message: res.message, isError: false });
        showToast(`Exchanged ${exchangeAmount.toLocaleString()} Diamonds to Coins!`);
      } else {
        setExchangeFeedback({ message: res.message, isError: true });
      }
    }, 400);
  };

  // Filtered transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (historyFilter === 'all') return true;
    if (historyFilter === 'recharge') return tx.type === 'recharge';
    if (historyFilter === 'withdrawal') return tx.type === 'withdrawal';
    if (historyFilter === 'reward') return tx.type === 'reward';
    if (historyFilter === 'gift_received') return tx.type === 'gift_received';
    return true;
  });

  return (
    <div className="relative w-full h-full min-h-screen pb-32 bg-[#09070F] text-white overflow-y-auto select-none">
      {/* Toast Feedback */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[#1E0F36]/95 border border-[#A855F7]/40 text-white text-xs font-bold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="sticky top-0 z-30 w-full bg-[#0E061B]/90 backdrop-blur-xl border-b border-[#A855F7]/20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={navigateBack}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-sm sm:text-base font-black text-white">Alpha Wallet</h1>
            <p className="text-[10px] text-zinc-400">Coins & Diamonds Treasury</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] text-emerald-300 font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>256-Bit SSL</span>
          </div>
        </div>
      </div>

      {/* Dual Balance Hero Section (Coins & Diamonds) */}
      <div className="p-4 space-y-3">
        <div className="relative rounded-3xl p-5 overflow-hidden bg-gradient-to-b from-[#230D42] via-[#16082C] to-[#0D041A] border border-[#A855F7]/40 shadow-2xl shadow-[#7928CA]/20">
          <div className="absolute -top-12 -right-12 w-36 h-36 rounded-full bg-[#EC4899]/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-36 h-36 rounded-full bg-[#7928CA]/30 blur-3xl pointer-events-none" />

          {/* Header Row */}
          <div className="relative z-10 flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-amber-400" />
              <span>Available Treasury Balances</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[9px] font-black border border-amber-400/30">
              10,000 💎 = $1.00 USD
            </span>
          </div>

          {/* Two Main Balance Blocks */}
          <div className="relative z-10 grid grid-cols-2 gap-3">
            {/* Box 1: Coins (Buying, Game wins, Daily bonus) */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-amber-400/30 backdrop-blur-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-amber-400 flex items-center justify-center text-black shadow">
                      <Coins className="w-3.5 h-3.5 fill-current text-black" />
                    </div>
                    <span className="text-[10.5px] font-black uppercase text-amber-300">Coins</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-200 font-bold">
                    Spending
                  </span>
                </div>

                <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight mt-1 truncate">
                  {coins.toLocaleString()}
                </div>
                <p className="text-[9.5px] text-zinc-400 mt-0.5 leading-tight">
                  For gifting, PK battles & lucky games
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('recharge')}
                className="mt-3 w-full py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-black font-black text-[10.5px] uppercase tracking-wider shadow cursor-pointer hover:brightness-110 active:scale-95 transition-all text-center flex items-center justify-center gap-1"
              >
                <Zap className="w-3 h-3 fill-current" />
                <span>Top Up ⚡</span>
              </button>
            </div>

            {/* Box 2: Diamonds (Earnings from live streams & party pk) */}
            <div className="p-3.5 rounded-2xl bg-black/40 border border-[#EC4899]/30 backdrop-blur-md flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-6 h-6 rounded-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] flex items-center justify-center text-white shadow">
                      <span className="text-xs">💎</span>
                    </div>
                    <span className="text-[10.5px] font-black uppercase text-pink-300">Diamonds</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-pink-500/20 text-pink-200 font-bold">
                    Earning
                  </span>
                </div>

                <div className="text-xl sm:text-2xl font-black font-mono text-[#EC4899] tracking-tight mt-1 truncate">
                  {diamonds.toLocaleString()}
                </div>
                <div className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 font-bold mt-0.5">
                  <span>≈ ${diamondsUSDValue} USD</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('withdraw')}
                className="mt-3 w-full py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-black text-[10.5px] uppercase tracking-wider shadow cursor-pointer hover:brightness-110 active:scale-95 transition-all text-center flex items-center justify-center gap-1"
              >
                <ArrowDownLeft className="w-3 h-3" />
                <span>Withdraw 💸</span>
              </button>
            </div>
          </div>
        </div>

        {/* Agency Direct Coin Seller Banner */}
        <div
          onClick={() => setCurrentScreen('agency_management')}
          className="p-3 rounded-2xl bg-gradient-to-r from-[#2B1405] via-[#1B0A2E] to-[#120524] border border-amber-400/40 hover:border-amber-400 transition-all flex items-center justify-between gap-3 shadow-md cursor-pointer group active:scale-[0.99]"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0 border border-amber-400/30">
              <Building2 className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-white group-hover:text-amber-300 transition-colors">
                  Get Coins Direct from Official Agency
                </span>
                <span className="text-[8.5px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-black">
                  INSTANT
                </span>
              </div>
              <p className="text-[10px] text-zinc-400 truncate">
                Zero fees & WhatsApp verified delivery • Stock: {agencyProfile.agencyBalance.toLocaleString()} Coins
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-zinc-400 group-hover:text-white shrink-0" />
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="px-4">
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-[#140929] border border-white/10 text-[11px] font-bold">
          {[
            { id: 'recharge', label: 'Top Up Coins', icon: Coins },
            { id: 'withdraw', label: 'Cash Out 💸', icon: ArrowDownLeft },
            { id: 'exchange', label: 'Convert 💎', icon: Repeat },
            { id: 'history', label: 'Records', icon: History },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-2 rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  isActive
                    ? 'bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-white shadow font-black'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =========================================================================
          TAB 1: COINS RECHARGE PACKAGES
          ========================================================================= */}
      {activeTab === 'recharge' && (
        <div className="p-4 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-300">
              Select Coin Package
            </span>
            <span className="text-[10px] text-amber-300 font-mono">
              Auto added to Coins wallet
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {coinPackages.map((pkg) => {
              const isSelected = selectedPackage.coins === pkg.coins;
              return (
                <div
                  key={pkg.coins}
                  onClick={() => setSelectedPackage(pkg)}
                  className={`relative p-3.5 rounded-2xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-gradient-to-b from-[#7928CA]/35 to-[#EC4899]/25 border-2 border-amber-400 shadow-xl shadow-amber-500/20 scale-[1.02]'
                      : 'bg-[#150D28] border border-white/5 hover:border-white/20'
                  }`}
                >
                  {pkg.popular && (
                    <div className="absolute -top-2 right-2 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-600 text-[8px] font-black text-black uppercase tracking-wider shadow">
                      Popular
                    </div>
                  )}
                  {pkg.bestValue && (
                    <div className="absolute -top-2 right-2 px-2 py-0.5 rounded-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-[8px] font-black text-white uppercase tracking-wider shadow">
                      Best Value
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-5 h-5 rounded-full bg-amber-400 flex items-center justify-center text-black">
                      <Coins className="w-3 h-3 fill-current" />
                    </div>
                    <span className="text-base font-black text-white font-mono">{pkg.coins.toLocaleString()}</span>
                  </div>

                  {pkg.bonus > 0 ? (
                    <span className="text-[10px] text-emerald-400 font-bold block mb-1">
                      +{pkg.bonus.toLocaleString()} Extra Bonus
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-500 block mb-1">Standard pack</span>
                  )}

                  <div className="mt-2 text-xs font-black text-amber-300 font-mono">
                    ${pkg.price.toFixed(2)} USD
                  </div>
                </div>
              );
            })}
          </div>

          {/* Payment Method Selector */}
          <div className="pt-1 space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-zinc-300 block">
              Payment Gateway
            </span>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'JazzCash', label: 'JazzCash' },
                { id: 'EasyPaisa', label: 'EasyPaisa' },
                { id: 'GooglePay', label: 'Google Pay' },
                { id: 'Card', label: 'Credit Card' },
              ].map((m) => {
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`py-2 rounded-xl text-[10.5px] font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#7928CA] border-purple-400 text-white shadow-md'
                        : 'bg-[#150D28] border-white/5 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Checkout Button */}
          <button
            type="button"
            onClick={handleCheckout}
            disabled={isProcessingRecharge}
            className="w-full h-12 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 font-black text-black text-xs uppercase tracking-wider shadow-lg shadow-amber-500/25 hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {isProcessingRecharge ? (
              <span>Connecting {paymentMethod}...</span>
            ) : (
              <span>
                Pay ${selectedPackage.price.toFixed(2)} for {(selectedPackage.coins + selectedPackage.bonus).toLocaleString()} Coins
              </span>
            )}
          </button>
        </div>
      )}

      {/* =========================================================================
          TAB 2: DIAMONDS WITHDRAWAL & CASHOUT (EARNINGS)
          ========================================================================= */}
      {activeTab === 'withdraw' && (
        <form onSubmit={handleSubmitWithdrawal} className="p-4 space-y-4 animate-fade-in">
          {/* Earnings Overview Card */}
          <div className="p-4 rounded-3xl bg-[#150A2B] border border-[#EC4899]/30 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10.5px] font-black uppercase tracking-wider text-pink-300 block">
                  Total Creator Earnings
                </span>
                <div className="text-xl sm:text-2xl font-black font-mono text-white mt-0.5">
                  {diamonds.toLocaleString()} 💎
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-zinc-400 block">Available Cashout</span>
                <span className="text-lg font-black font-mono text-emerald-400">
                  ${diamondsUSDValue} USD
                </span>
              </div>
            </div>

            {/* Threshold Notice */}
            <div
              className={`p-2.5 rounded-xl border text-[11px] flex items-center gap-2 ${
                isEligibleForWithdraw
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-200'
              }`}
            >
              <Info className="w-4 h-4 shrink-0" />
              <span>
                {isEligibleForWithdraw
                  ? 'You meet the minimum withdrawal threshold ($10.00 / 100,000 Diamonds).'
                  : `Minimum withdrawal is $10.00 (100,000 Diamonds). You need ${(100000 - diamonds).toLocaleString()} more Diamonds.`}
              </span>
            </div>
          </div>

          {/* Amount to Withdraw in USD */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300">
                Withdrawal Amount ($ USD)
              </label>
              <span className="text-xs font-mono font-bold text-amber-300">
                Requires: {diamondsNeededForChosenUSD.toLocaleString()} 💎
              </span>
            </div>

            <div className="relative">
              <DollarSign className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                min={10}
                max={Math.max(10, Math.floor(diamonds / 10000))}
                step={1}
                value={withdrawAmountUSD}
                onChange={(e) => setWithdrawAmountUSD(parseFloat(e.target.value) || 0)}
                placeholder="10"
                className="w-full h-11 pl-9 pr-3.5 rounded-xl bg-white/5 border border-white/15 focus:border-emerald-400 focus:outline-none text-sm font-mono font-bold text-white"
              />
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-5 gap-1.5 mt-2">
              {[10, 25, 50, 100, 250].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setWithdrawAmountUSD(amt)}
                  className={`py-1 rounded-xl text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    withdrawAmountUSD === amt
                      ? 'bg-emerald-500 text-black shadow'
                      : 'bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5'
                  }`}
                >
                  ${amt}
                </button>
              ))}
            </div>
          </div>

          {/* Withdrawal Destination Method */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300 block">
              Withdrawal Channel
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'JazzCash', label: 'JazzCash' },
                { id: 'EasyPaisa', label: 'EasyPaisa' },
                { id: 'Bank', label: 'Bank Wire' },
                { id: 'USDT', label: 'USDT TRC20' },
              ].map((m) => {
                const isSelected = withdrawMethod === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setWithdrawMethod(m.id as any)}
                    className={`py-2 rounded-xl text-[10.5px] font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 border-emerald-400 text-white shadow'
                        : 'bg-white/5 border-white/5 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Account Details Form */}
          <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-3">
            {withdrawMethod === 'Bank' && (
              <div>
                <label className="text-[10.5px] font-bold text-zinc-300 block mb-1">
                  Bank Name
                </label>
                <select
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-[#140929] border border-white/15 focus:border-emerald-400 text-xs text-white"
                >
                  <option value="Meezan Bank">Meezan Bank</option>
                  <option value="Habib Bank Limited (HBL)">Habib Bank Limited (HBL)</option>
                  <option value="Bank Alfalah">Bank Alfalah</option>
                  <option value="United Bank Limited (UBL)">United Bank Limited (UBL)</option>
                  <option value="Standard Chartered">Standard Chartered</option>
                  <option value="SadaPay">SadaPay</option>
                  <option value="NayaPay">NayaPay</option>
                </select>
              </div>
            )}

            <div>
              <label className="text-[10.5px] font-bold text-zinc-300 block mb-1">
                Account Title (Beneficiary Name)
              </label>
              <input
                type="text"
                value={accountTitle}
                onChange={(e) => setAccountTitle(e.target.value)}
                placeholder="e.g. Muhammad Ali"
                className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 focus:border-emerald-400 focus:outline-none text-xs text-white"
              />
            </div>

            <div>
              <label className="text-[10.5px] font-bold text-zinc-300 block mb-1">
                {withdrawMethod === 'Bank'
                  ? 'IBAN / Account Number'
                  : withdrawMethod === 'USDT'
                  ? 'USDT TRC-20 Wallet Address'
                  : `${withdrawMethod} Mobile Number`}
              </label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder={
                  withdrawMethod === 'Bank'
                    ? 'PK36MEZN0000...'
                    : withdrawMethod === 'USDT'
                    ? 'T...'
                    : '03001234567'
                }
                className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/15 focus:border-emerald-400 focus:outline-none text-xs font-mono text-white"
              />
            </div>
          </div>

          {/* Feedback */}
          {withdrawError && (
            <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{withdrawError}</span>
            </div>
          )}

          {withdrawSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{withdrawSuccess}</span>
            </div>
          )}

          {/* Submit Withdrawal Request Button */}
          <button
            type="submit"
            disabled={!isEligibleForWithdraw || isProcessingWithdraw || withdrawAmountUSD < 10}
            className={`w-full h-12 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${
              !isEligibleForWithdraw || isProcessingWithdraw || withdrawAmountUSD < 10
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
                : 'bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-white shadow-emerald-500/25 hover:brightness-110 active:scale-95 cursor-pointer'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>
              {isProcessingWithdraw
                ? 'Submitting...'
                : `Cash Out $${withdrawAmountUSD.toFixed(2)} USD`}
            </span>
          </button>
        </form>
      )}

      {/* =========================================================================
          TAB 3: CONVERT DIAMONDS TO COINS (EXCHANGE)
          ========================================================================= */}
      {activeTab === 'exchange' && (
        <div className="p-4 space-y-4 animate-fade-in">
          <div className="p-4 rounded-3xl bg-[#150A2B] border border-purple-400/30 space-y-2">
            <h3 className="text-sm font-black text-white flex items-center gap-1.5">
              <Repeat className="w-4 h-4 text-amber-400" />
              <span>Convert Diamonds to Coins</span>
            </h3>
            <p className="text-[11px] text-zinc-300">
              Turn your streaming earnings into coins instantly to send gifts to friends or enter PK matches with 0 fees!
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-black uppercase tracking-wider text-zinc-300">
                Diamonds to Convert
              </label>
              <span className="text-xs font-mono font-bold text-pink-300">
                Max: {diamonds.toLocaleString()} 💎
              </span>
            </div>

            <input
              type="number"
              min={1000}
              max={diamonds}
              step={1000}
              value={exchangeAmount}
              onChange={(e) => setExchangeAmount(parseInt(e.target.value, 10) || 0)}
              className="w-full h-11 px-3.5 rounded-xl bg-white/5 border border-white/15 focus:border-amber-400 focus:outline-none text-sm font-mono font-bold text-amber-300"
            />

            {/* Quick Chips */}
            <div className="grid grid-cols-4 gap-1.5 mt-2">
              {[10000, 50000, 100000, diamonds].map((val, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setExchangeAmount(val)}
                  className="py-1 rounded-xl bg-white/5 hover:bg-white/10 text-[10px] font-mono font-bold text-zinc-300 border border-white/5 cursor-pointer"
                >
                  {val === diamonds ? 'All Diamonds' : `${val / 1000}k 💎`}
                </button>
              ))}
            </div>
          </div>

          {/* Conversion Preview Box */}
          <div className="p-3.5 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between">
            <div className="text-center flex-1">
              <span className="text-[10px] text-zinc-400 uppercase block">Converting</span>
              <span className="text-sm font-mono font-black text-[#EC4899]">
                -{exchangeAmount.toLocaleString()} 💎
              </span>
            </div>

            <Repeat className="w-4 h-4 text-zinc-500" />

            <div className="text-center flex-1">
              <span className="text-[10px] text-zinc-400 uppercase block">Receiving</span>
              <span className="text-sm font-mono font-black text-amber-300">
                +{exchangeAmount.toLocaleString()} Coins
              </span>
            </div>
          </div>

          {exchangeFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                exchangeFeedback.isError
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-200'
                  : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-200'
              }`}
            >
              {exchangeFeedback.isError ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <span>{exchangeFeedback.message}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleExecuteExchange}
            disabled={isProcessingExchange || exchangeAmount <= 0 || diamonds < exchangeAmount}
            className={`w-full h-12 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all ${
              isProcessingExchange || exchangeAmount <= 0 || diamonds < exchangeAmount
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed opacity-60'
                : 'bg-gradient-to-r from-amber-400 via-pink-500 to-[#7928CA] text-white shadow-purple-500/25 hover:brightness-110 active:scale-95 cursor-pointer'
            }`}
          >
            <Repeat className="w-4 h-4" />
            <span>
              {isProcessingExchange ? 'Converting...' : 'Instant Convert to Coins'}
            </span>
          </button>
        </div>
      )}

      {/* =========================================================================
          TAB 4: TRANSACTION & WALLET RECORDS
          ========================================================================= */}
      {activeTab === 'history' && (
        <div className="p-4 space-y-3 animate-fade-in">
          {/* History filter chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-[10px] font-bold">
            {[
              { id: 'all', label: 'All Records' },
              { id: 'recharge', label: 'Top-Ups' },
              { id: 'withdrawal', label: 'Withdrawals' },
              { id: 'gift_received', label: 'Earnings' },
              { id: 'reward', label: 'Rewards' },
            ].map((f) => {
              const isSelected = historyFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setHistoryFilter(f.id as any)}
                  className={`px-2.5 py-1 rounded-xl whitespace-nowrap cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-purple-600 text-white shadow-sm border border-purple-400'
                      : 'bg-white/5 hover:bg-white/10 text-zinc-400 border border-white/5'
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>

          {filteredTransactions.length === 0 ? (
            <div className="p-8 rounded-3xl bg-[#140929] border border-white/5 text-center space-y-1.5">
              <History className="w-8 h-8 text-zinc-500 mx-auto" />
              <p className="text-xs font-bold text-zinc-300">No transactions found</p>
              <p className="text-[10px] text-zinc-500">
                Your top-up, rewards, earnings and cashout logs will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTransactions.map((tx) => {
                const isPositive =
                  tx.type === 'recharge' ||
                  tx.type === 'reward' ||
                  tx.type === 'gift_received';

                return (
                  <div
                    key={tx.id}
                    className="p-3.5 rounded-2xl bg-[#140D26] border border-white/5 flex items-center justify-between gap-3 shadow-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          tx.type === 'withdrawal'
                            ? 'bg-rose-500/20 text-rose-300'
                            : isPositive
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-white/5 text-zinc-400'
                        }`}
                      >
                        {tx.type === 'withdrawal' ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : isPositive ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <Coins className="w-4 h-4" />
                        )}
                      </div>

                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-white truncate">{tx.title}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5 font-mono">
                          <span>{tx.date}</span>
                          <span>•</span>
                          <span className="uppercase text-[9px] text-zinc-500 font-bold">
                            {tx.type}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`text-xs font-black font-mono ${
                          tx.type === 'withdrawal'
                            ? 'text-rose-400'
                            : isPositive
                            ? 'text-emerald-400'
                            : 'text-zinc-300'
                        }`}
                      >
                        {tx.type === 'withdrawal' ? '-' : isPositive ? '+' : '-'}
                        {tx.amount.toLocaleString()} {tx.currency}
                      </div>

                      <span
                        className={`text-[8.5px] px-1.5 py-0.2 rounded font-black uppercase inline-block mt-0.5 ${
                          tx.status === 'completed'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-amber-400/20 text-amber-300'
                        }`}
                      >
                        {tx.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
