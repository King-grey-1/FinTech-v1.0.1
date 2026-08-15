type LedgerEntry = {
  transactionId: string;
  userId: string;
  walletId: string;
  transactionType: string;
  amount: string;
  currency: string;
  debitAccount: string;
  creditAccount: string;
  status: 'POSTED';
  reference: string;
  description: string;
  createdAt: string;
};

export function createLedgerEntry(input: Omit<LedgerEntry, 'status' | 'createdAt'>): LedgerEntry {
  return {
    ...input,
    status: 'POSTED',
    createdAt: new Date().toISOString(),
  };
}

export function computeBalance(
  availableBalance: string,
  lockedBalance: string,
  pendingBalance: string,
): string {
  return (Number(availableBalance) + Number(lockedBalance) + Number(pendingBalance)).toFixed(2);
}

export function validateWithdrawal(amount: string, availableWithdrawableBalance: string): { valid: boolean; reason?: string } {
  const requested = Number(amount);
  const available = Number(availableWithdrawableBalance);

  if (requested <= 0) {
    return { valid: false, reason: 'Withdrawal amount must be greater than zero.' };
  }

  if (requested > available) {
    return { valid: false, reason: 'INSUFFICIENT_WITHDRAWABLE_BALANCE' };
  }

  return { valid: true };
}
