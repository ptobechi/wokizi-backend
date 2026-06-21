export interface InitializePaymentResult {
  authorizationUrl: string;
  accessCode:       string;
  reference:        string;
}

export interface VerifyPaymentResult {
  success:      boolean;
  reference:    string;
  amount:       number; // in kobo
  currency:     string;
  channel:      string;
  paidAt:       string | null;
  customerEmail?: string;
  metadata?:    Record<string, unknown>;
  error?:       string;
}

export interface RefundResult {
  success:  boolean;
  refundId?: string;
  error?:   string;
}

export interface CreateRecipientResult {
  success:       boolean;
  recipientCode?: string;
  error?:        string;
}

export interface InitiateTransferResult {
  success:       boolean;
  transferCode?: string;
  reference?:    string;
  error?:        string;
}

export interface IPaymentProvider {
  initializePayment(
    amount: number,
    email: string,
    reference: string,
    metadata?: Record<string, unknown>,
    channels?: string[],
  ): Promise<InitializePaymentResult>;

  verifyPayment(reference: string): Promise<VerifyPaymentResult>;

  refund(transactionReference: string, amount?: number): Promise<RefundResult>;

  createTransferRecipient(
    accountName: string,
    accountNumber: string,
    bankCode: string,
  ): Promise<CreateRecipientResult>;

  initiateTransfer(
    amount: number,
    recipientCode: string,
    reference: string,
    reason?: string,
  ): Promise<InitiateTransferResult>;

  verifyTransfer(transferCode: string): Promise<{ success: boolean; status: string; error?: string }>;

  validateWebhookSignature(payload: string, signature: string): boolean;
}
