export interface WalletBalance {
  availableBalance: string;
  lockedBalance: string;
  pendingBalance: string;
}

export function applyDeposit(current: WalletBalance, amount: string): WalletBalance {
  return {
    availableBalance: (Number(current.availableBalance) + Number(amount)).toFixed(2),
    lockedBalance: current.lockedBalance,
    pendingBalance: current.pendingBalance,
  };
}

export function applyInvestmentAllocation(current: WalletBalance, amount: string): WalletBalance {
  const available = Number(current.availableBalance) - Number(amount);
  const locked = Number(current.lockedBalance) + Number(amount);

  return {
    availableBalance: available.toFixed(2),
    lockedBalance: locked.toFixed(2),
    pendingBalance: current.pendingBalance,
  };
}

export function settleInvestmentAtMaturity(
  current: WalletBalance,
  principal: string,
  realizedProfit: string,
  fee: string,
): WalletBalance {
  const netSettlement = Number(principal) + Number(realizedProfit) - Number(fee);

  return {
    availableBalance: (Number(current.availableBalance) + netSettlement).toFixed(2),
    lockedBalance: '0.00',
    pendingBalance: current.pendingBalance,
  };
}

export function validateWithdrawal(amount: string, availableWithdrawableBalance: string): { valid: boolean; reason?: string } {
  const requested = Number(amount);
  const available = Number(availableWithdrawableBalance);

  if (requested <= 0) {
    return { valid: false, reason: 'WITHDRAWAL_MUST_BE_POSITIVE' };
  }

  if (requested > available) {
    return { valid: false, reason: 'INSUFFICIENT_WITHDRAWABLE_BALANCE' };
  }

  return { valid: true };
}
