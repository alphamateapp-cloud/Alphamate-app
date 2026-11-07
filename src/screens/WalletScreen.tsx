import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Wallet, ShieldCheck, CreditCard, ChevronRight, CheckCircle2, History, Sparkles } from 'lucide-react';

export const WalletScreen: React.FC = () => {
  const { coins, diamonds, transactions, rechargeCoins, navigateBack } = useApp();

  const [activeTab, setActiveTab] = useState<'recharge' | 'history' | 'diamonds'>('recharge');
  const [selectedPackage, setSelectedPackage] = useState<{ coins: number; price: number; bonus: number }>({
    coins: 1000,
    price: 9.99,
    bonus: 100,
  });
  const [paymentMethod, setPaymentMethod] = useState<'ApplePay' | 'GooglePay' | 'Card'>('ApplePay');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const coinPackages = [
    { coins: 100, price: 0.99, bonus: 0 },
    { coins: 500, price: 4.99, bonus: 25 },
    { coins: 1000, price: 9.99, bonus: 100, popular: true },
    { coins: 3000, price: 29.99, bonus: 450 },
    { coins: 10000, price: 99.99, bonus: 2000, bestValue: true },
    { coins: 30000, price: 299.99, bonus: 7500 },
  ];

  const handleCheckout = async () => {
    setIsProcessing(true);
    const success = await rechargeCoins(
      selectedPackage.coins + selectedPackage.bonus,
      selectedPackage.price,
      paymentMethod
    );
    setIsProcessing(false);
    if (success) {
      setSuccessMessage(
        `Successfully added ${(selectedPackage.coins + selectedPackage.bonus).toLocaleString()} Coins to your Alpha Mate Wallet!`
      );
      setTimeout(() => setSuccessMessage(null), 3500);
    }
  };

  return (
    <div className="relative w-full h-full min-h-screen pb-32 bg-[#09070F] text-white overflow-y-auto">
      {/* Top Header */}
      <div className="sticky top-0 z-30 w-full bg-[#09070F]/85 backdrop-blur-md border-b border-[#A855F7]/15 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={navigateBack}
            className="w-8 h-8 rounded-full bg-[#1A1133] flex items-center justify-center text-zinc-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-base font-bold text-white">Wallet & Top Up</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-emerald-400 font-semibold">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>256-Bit SSL</span>
        </div>
      </div>

      {/* Wallet Balance Card */}
      <div className="p-4">
        <div className="relative rounded-3xl p-5 overflow-hidden bg-gradient-to-tr from-[#1B0F38] via-[#2D1554] to-[#160B2A] border border-[#A855F7]/30 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-zinc-300 uppercase tracking-widest">
              Available Balances
            </span>
            <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-[#7928CA] to-[#EC4899] text-[9px] font-black text-white">
              VIP ROYAL
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Coins */}
            <div className="p-3 rounded-2xl bg-[#130A24]/70 border border-amber-400/20 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">💰</span>
                <span className="text-[11px] font-bold text-zinc-300 uppercase">Coins</span>
              </div>
              <div className="text-xl font-black text-amber-300 font-mono">
                {coins.toLocaleString()}
              </div>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">Used for Gifts & PK battles</span>
            </div>

            {/* Diamonds */}
            <div className="p-3 rounded-2xl bg-[#130A24]/70 border border-[#EC4899]/20 backdrop-blur-md">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">💎</span>
                <span className="text-[11px] font-bold text-zinc-300 uppercase">Diamonds</span>
              </div>
              <div className="text-xl font-black text-[#EC4899] font-mono">
                {diamonds.toLocaleString()}
              </div>
              <span className="text-[10px] text-zinc-400 mt-0.5 block">Earned from Live Streams</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Recharge | Transaction History | Cashout */}
      <div className="px-4 border-b border-[#A855F7]/15 flex items-center justify-around">
        {[
          { id: 'recharge', label: 'Top Up Coins' },
          { id: 'history', label: 'Transactions' },
          { id: 'diamonds', label: 'Diamonds & Cashout' },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-2.5 pt-1 text-xs font-bold transition-all cursor-pointer relative ${
                isActive ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.label}
              {isActive && (
                <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#7928CA] to-[#EC4899]" />
              )}
            </button>
          );
        })}
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div className="m-4 p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Tab 1: Recharge Packages */}
      {activeTab === 'recharge' && (
        <div className="p-4 space-y-4">
          <span className="text-xs text-zinc-400 font-semibold block">Select Coin Package</span>

          <div className="grid grid-cols-2 gap-3">
            {coinPackages.map((pkg) => {
              const isSelected = selectedPackage.coins === pkg.coins;
              return (
                <div
                  key={pkg.coins}
                  onClick={() => setSelectedPackage(pkg)}
                  className={`relative p-3.5 rounded-2xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-gradient-to-b from-[#7928CA]/30 to-[#EC4899]/20 border-2 border-[#EC4899] shadow-lg shadow-[#EC4899]/20'
                      : 'bg-[#150D28] border border-white/5 hover:border-white/20'
                  }`}
                >
                  {pkg.popular && (
                    <div className="absolute -top-2 right-2 px-2 py-0.5 rounded-full bg-gradient-to-r from-[#EC4899] to-[#F59E0B] text-[8px] font-black text-white uppercase tracking-wider">
                      Popular
                    </div>
                  )}
                  {pkg.bestValue && (
                    <div className="absolute -top-2 right-2 px-2 py-0.5 rounded-full bg-gradient-to-r from-[#7928CA] to-[#A855F7] text-[8px] font-black text-white uppercase tracking-wider">
                      Best Value
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-lg">💰</span>
                    <span className="text-sm font-black text-white">{pkg.coins.toLocaleString()}</span>
                  </div>

                  {pkg.bonus > 0 && (
                    <span className="text-[10px] text-emerald-400 font-bold block mb-2">
                      +{pkg.bonus.toLocaleString()} Bonus
                    </span>
                  )}

                  <div className="mt-2 text-xs font-bold text-amber-300">${pkg.price.toFixed(2)}</div>
                </div>
              );
            })}
          </div>

          {/* Payment Method Selector */}
          <div className="pt-2">
            <span className="text-xs text-zinc-400 font-semibold block mb-2">Payment Method</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'ApplePay', label: 'Apple Pay' },
                { id: 'GooglePay', label: 'Google Pay' },
                { id: 'Card', label: 'Credit Card' },
              ].map((m) => {
                const isSelected = paymentMethod === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id as any)}
                    className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                      isSelected
                        ? 'bg-[#7928CA] border-[#EC4899] text-white shadow-md'
                        : 'bg-[#150D28] border-white/5 text-zinc-400'
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
            onClick={handleCheckout}
            disabled={isProcessing}
            className="w-full h-12 mt-2 rounded-xl bg-gradient-to-r from-[#7928CA] via-[#9333EA] to-[#EC4899] font-bold text-white text-xs sm:text-sm shadow-lg shadow-[#7928CA]/40 hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <span>Securing payment with {paymentMethod}...</span>
            ) : (
              <span>
                Pay ${selectedPackage.price.toFixed(2)} for {(selectedPackage.coins + selectedPackage.bonus).toLocaleString()} Coins
              </span>
            )}
          </button>
        </div>
      )}

      {/* Tab 2: Transaction History */}
      {activeTab === 'history' && (
        <div className="p-4 space-y-2.5">
          {transactions.map((tx) => (
            <div
              key={tx.id}
              className="p-3.5 rounded-2xl bg-[#140D26] border border-white/5 flex items-center justify-between"
            >
              <div>
                <h4 className="text-xs font-bold text-white">{tx.title}</h4>
                <span className="text-[10px] text-zinc-500">{tx.date}</span>
              </div>
              <div className="text-right">
                <span
                  className={`text-xs font-bold ${
                    tx.type === 'recharge' || tx.type === 'gift_received'
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {tx.type === 'recharge' || tx.type === 'gift_received' ? '+' : '-'}
                  {tx.amount.toLocaleString()} {tx.currency}
                </span>
                <span className="text-[9px] text-zinc-400 block uppercase">{tx.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Diamonds & Earnings Cashout */}
      {activeTab === 'diamonds' && (
        <div className="p-4 space-y-4">
          <div className="p-4 rounded-2xl bg-[#150D28] border border-[#EC4899]/30">
            <h4 className="text-sm font-bold text-white mb-1">Creator Earnings Program</h4>
            <p className="text-xs text-zinc-400 mb-3">
              1,000 Diamonds = $10.00 USD. Cash out directly to PayPal or Bank Account.
            </p>
            <div className="text-lg font-black text-emerald-400 font-mono mb-3">
              Estimated Value: ${(diamonds / 100).toFixed(2)} USD
            </div>
            <button
              onClick={() => alert('Withdrawal request initialized for review! Processing within 24 hours.')}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-bold"
            >
              Withdraw to Bank / PayPal
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
