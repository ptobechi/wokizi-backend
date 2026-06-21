export const mockAuthService = {
  sendOtp: jest.fn(),
  verifyOtp: jest.fn(),
  refreshTokens: jest.fn(),
  logout: jest.fn(),
};

export const mockUsersService = {
  getMe: jest.fn(),
  updateMe: jest.fn(),
  getPublicProfile: jest.fn(),
  getSessions: jest.fn(),
  revokeSession: jest.fn(),
  revokeAllSessions: jest.fn(),
  deactivate: jest.fn(),
};

export const mockBookingsService = {
  create: jest.fn(),
  findMine: jest.fn(),
  findById: jest.fn(),
  updateStatus: jest.fn(),
  checkAvailability: jest.fn(),
};

export const mockQuotationsService = {
  create: jest.fn(),
  revise: jest.fn(),
  respond: jest.fn(),
  getConversationQuotations: jest.fn(),
  getMyQuotations: jest.fn(),
};

export const mockPaymentsService = {
  initiateFunding: jest.fn(),
  verifyFunding: jest.fn(),
  createEscrow: jest.fn(),
  handleWebhook: jest.fn(),
};

export const mockWalletService = {
  getWallet: jest.fn(),
  getTransactions: jest.fn(),
};

export const mockWithdrawalsService = {
  requestWithdrawal: jest.fn(),
  listMine: jest.fn(),
  listBanks: jest.fn(),
};

export const mockVerificationService = {
  submit: jest.fn(),
  getMyVerification: jest.fn(),
  listPending: jest.fn(),
  review: jest.fn(),
};

export const mockReviewsService = {
  create: jest.fn(),
  getServiceReviews: jest.fn(),
  getProviderReviews: jest.fn(),
};

export const mockConversationsService = {
  create: jest.fn(),
  findAll: jest.fn(),
  findAllArchived: jest.fn(),
  findById: jest.fn(),
  archive: jest.fn(),
};

export const mockSupportService = {
  createTicket: jest.fn(),
  getMyTickets: jest.fn(),
  getTicketById: jest.fn(),
  listAllTickets: jest.fn(),
  updateTicket: jest.fn(),
};

export const mockEventEmitter = {
  emit: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
};

export const mockPaystackService = {
  initializeTransaction: jest.fn(),
  verifyTransaction: jest.fn(),
  initiateTransfer: jest.fn(),
  listBanks: jest.fn(),
  resolveAccount: jest.fn(),
  verifyWebhook: jest.fn(),
};

export const mockNotificationsService = {
  send: jest.fn(),
  markRead: jest.fn(),
  getUserNotifications: jest.fn(),
};
