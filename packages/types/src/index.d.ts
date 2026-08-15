export type CurrencyCode = 'USD' | 'EUR' | 'GBP';
export type RoleName = 'USER' | 'SUPPORT' | 'FINANCE' | 'TRADER' | 'RISK_MANAGER' | 'COMPLIANCE' | 'ADMIN' | 'SUPER_ADMIN';
export type KycStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export type VerificationStatus = 'PENDING' | 'VERIFIED' | 'FAILED';
export type WalletStatus = 'ACTIVE' | 'LOCKED' | 'SUSPENDED';
export type InvestmentStatus = 'DRAFT' | 'ACTIVE' | 'MATURED' | 'CANCELLED' | 'PAUSED';
export type WithdrawalStatus = 'REQUESTED' | 'UNDER_REVIEW' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AccountType = 'DEMO' | 'BROKER' | 'PROP_FIRM' | 'INTERNAL_STRATEGY';
export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL' | 'INVESTMENT' | 'ALLOCATION' | 'PROFIT' | 'LOSS' | 'FEE' | 'REFUND' | 'ADJUSTMENT';
export interface User {
    id: string;
    email: string;
    phone?: string;
    passwordHash: string;
    firstName: string;
    lastName: string;
    dateOfBirth?: string;
    country?: string;
    status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
    emailVerified: boolean;
    mfaEnabled: boolean;
    createdAt: string;
    updatedAt: string;
}
export interface KycRecord {
    id: string;
    userId: string;
    verificationStatus: KycStatus;
    documentType?: string;
    documentReference?: string;
    submittedAt?: string;
    reviewedAt?: string;
    reviewerId?: string;
    rejectionReason?: string;
}
export interface Wallet {
    id: string;
    userId: string;
    currency: CurrencyCode;
    availableBalance: string;
    lockedBalance: string;
    pendingBalance: string;
    createdAt: string;
}
export interface LedgerTransaction {
    transactionId: string;
    userId: string;
    walletId: string;
    transactionType: TransactionType;
    amount: string;
    currency: CurrencyCode;
    debitAccount: string;
    creditAccount: string;
    status: 'PENDING' | 'POSTED' | 'REVERSED';
    reference: string;
    description: string;
    createdAt: string;
}
export interface InvestmentProduct {
    id: string;
    name: string;
    minInvestment: string;
    maxInvestment?: string;
    durationDays: number;
    expectedReturn: string;
    performanceFee: string;
    managementFee: string;
    riskLevel: RiskLevel;
    lockUpDays: number;
    withdrawalRules: string;
    status: 'DRAFT' | 'ACTIVE' | 'DISABLED';
    termsAndConditions: string;
    complianceStatus: string;
    createdAt: string;
    updatedAt: string;
}
export interface InvestmentPosition {
    id: string;
    userId: string;
    productId: string;
    walletId: string;
    principalAmount: string;
    allocatedAmount: string;
    realizedProfit: string;
    unrealizedProfit: string;
    feesPaid: string;
    status: InvestmentStatus;
    startAt: string;
    maturityAt?: string;
    createdAt: string;
    updatedAt: string;
}
export interface PaymentProviderTransaction {
    id: string;
    userId: string;
    internalTxnId: string;
    providerTxnId?: string;
    amount: string;
    currency: CurrencyCode;
    status: 'INITIATED' | 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REVERSED';
    paymentMethod: string;
    verificationStatus: VerificationStatus;
    createdAt: string;
}
export interface RiskEvent {
    id: string;
    userId: string;
    score: number;
    level: RiskLevel;
    reason: string;
    createdAt: string;
}
export interface AuditLog {
    id: string;
    actorId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    previousState?: Record<string, unknown>;
    newState?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
    createdAt: string;
}
export interface ApiErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
    };
}
export interface ApiSuccessResponse<T> {
    success: true;
    data: T;
}
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
