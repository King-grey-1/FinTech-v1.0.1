export interface PaymentProvider {
  createDeposit(input: { amount: string; currency: string; userId: string }): Promise<{ providerTxnId: string; status: string }>;
  createWithdrawal(input: { amount: string; currency: string; userId: string; accountDetails: string }): Promise<{ providerTxnId: string; status: string }>;
  verifyPayment(providerTxnId: string): Promise<boolean>;
  getTransaction(providerTxnId: string): Promise<{ providerTxnId: string; status: string; timestamp?: string } | null>;
  refundPayment(providerTxnId: string): Promise<boolean>;
  verifyWithdrawalCompletion(providerTxnId: string): Promise<{ completed: boolean; finalStatus: string }>;
  handleWebhook(payload: Record<string, unknown>): Promise<boolean>;
}

/**
 * Payment provider verification state to prevent double-processing.
 * In production, persisted to database.
 */
class ProcessingState {
  private processing: Map<string, boolean> = new Map();

  isProcessing(providerTxnId: string): boolean {
    return this.processing.get(providerTxnId) ?? false;
  }

  markProcessing(providerTxnId: string): void {
    this.processing.set(providerTxnId, true);
  }

  clearProcessing(providerTxnId: string): void {
    this.processing.delete(providerTxnId);
  }
}

export class DemoPaymentProvider implements PaymentProvider {
  private processingState = new ProcessingState();

  async createDeposit(input: { amount: string; currency: string; userId: string }): Promise<{ providerTxnId: string; status: string }> {
    return {
      providerTxnId: `demo-dep-${Date.now()}`,
      status: 'PENDING',
    };
  }

  async createWithdrawal(input: { amount: string; currency: string; userId: string; accountDetails: string }): Promise<{ providerTxnId: string; status: string }> {
    // Validate account details format
    if (!input.accountDetails || input.accountDetails.length === 0) {
      throw new Error('Invalid account details for withdrawal.');
    }

    return {
      providerTxnId: `demo-wdr-${Date.now()}`,
      status: 'INITIATED',
    };
  }

  async verifyPayment(_providerTxnId: string): Promise<boolean> {
    return true;
  }

  async getTransaction(providerTxnId: string): Promise<{ providerTxnId: string; status: string; timestamp?: string } | null> {
    return {
      providerTxnId,
      status: 'PENDING',
      timestamp: new Date().toISOString(),
    };
  }

  async refundPayment(_providerTxnId: string): Promise<boolean> {
    return true;
  }

  /**
   * Verify withdrawal is complete and has reached final state.
   * Prevents double-settlement of the same withdrawal.
   */
  async verifyWithdrawalCompletion(providerTxnId: string): Promise<{ completed: boolean; finalStatus: string }> {
    // In production, query the provider's API or database
    // For demo, assume all withdrawals complete successfully after initiation
    return {
      completed: true,
      finalStatus: 'SUCCESS',
    };
  }

  async handleWebhook(_payload: Record<string, unknown>): Promise<boolean> {
    return true;
  }
}
