import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OtpType } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { EncryptionService } from '../../../core/security/encryption.service';
import { SmsService } from '../../../integrations/sms/sms.service';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-uuid-1',
  phone: '+2348012345678',
  role: 'USER',
  isActive: true,
  isSuspended: false,
  isPhoneVerified: true,
};

const mockOtp = {
  id: 'otp-uuid-1',
  userId: mockUser.id,
  code: '123456',
  type: OtpType.PHONE_AUTH,
  isUsed: false,
  attempts: 0,
  expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min in future
  createdAt: new Date(),
};

// ─── Factory ──────────────────────────────────────────────────────────────────

function buildPrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    otpCode: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    refreshToken: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    userDevice: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    userProfile: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;
  let prisma: ReturnType<typeof buildPrismaMock>;
  let encryption: jest.Mocked<EncryptionService>;
  let sms: jest.Mocked<SmsService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    prisma = buildPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService,    useValue: prisma },
        { provide: JwtService,       useValue: { sign: jest.fn().mockReturnValue('signed-token'), verify: jest.fn() } },
        { provide: ConfigService,    useValue: { get: jest.fn((key: string, def?: unknown) => {
              if (key === 'app.otpMaxAttempts') return 5;
              if (key === 'app.otpExpiresMinutes') return 10;
              return def ?? 'mock-value';
            }) } },
        { provide: EncryptionService, useValue: {
            generateOtp:    jest.fn().mockReturnValue('123456'),
            getOtpExpiry:   jest.fn().mockReturnValue(new Date(Date.now() + 600_000)),
            hashToken:      jest.fn().mockResolvedValue('hashed-token'),
            compareToken:   jest.fn().mockResolvedValue(true),
            hash:           jest.fn().mockResolvedValue('hashed'),
            compare:        jest.fn().mockResolvedValue(true),
          },
        },
        { provide: SmsService, useValue: { sendOtp: jest.fn().mockResolvedValue({ success: true }) } },
      ],
    }).compile();

    service      = module.get<AuthService>(AuthService);
    encryption   = module.get(EncryptionService);
    sms          = module.get(SmsService);
    jwtService   = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── sendOtp ─────────────────────────────────────────────────────────────────

  describe('sendOtp', () => {
    const dto = { phone: '+2348012345678' };

    it('sends OTP to existing verified user and returns isNewUser=false', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });
      prisma.otpCode.create.mockResolvedValue({ id: 'otp-1' });

      const result = await service.sendOtp(dto);

      expect(sms.sendOtp).toHaveBeenCalledWith(dto.phone, '123456');
      expect(result.isNewUser).toBe(false);
      expect(result.message).toMatch(/sent/i);
    });

    it('creates ghost user and sends OTP for unknown phone, isNewUser=true', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'ghost-id' });
      prisma.otpCode.create.mockResolvedValue({ id: 'otp-1' });

      const result = await service.sendOtp(dto);

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ phone: dto.phone, isActive: false }),
        }),
      );
      expect(result.isNewUser).toBe(true);
    });

    it('sends OTP for unverified existing user and returns isNewUser=true', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, isPhoneVerified: false });
      prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });
      prisma.otpCode.create.mockResolvedValue({ id: 'otp-1' });

      const result = await service.sendOtp(dto);

      expect(result.isNewUser).toBe(true);
    });

    it('invalidates previous unused OTPs for returning user', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.otpCode.updateMany.mockResolvedValue({ count: 1 });
      prisma.otpCode.create.mockResolvedValue({ id: 'otp-1' });

      await service.sendOtp(dto);

      expect(prisma.otpCode.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isUsed: false }),
          data: { isUsed: true },
        }),
      );
    });

    it('throws ServiceUnavailableException and cleans up ghost user when SMS fails for new user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({ id: 'ghost-id' });
      prisma.otpCode.create.mockResolvedValue({ id: 'otp-1' });
      sms.sendOtp.mockResolvedValue({ success: false });
      prisma.user.delete.mockResolvedValue({});

      await expect(service.sendOtp(dto)).rejects.toThrow(ServiceUnavailableException);
      expect(prisma.user.delete).toHaveBeenCalled();
    });

    it('throws ServiceUnavailableException when SMS fails for existing user (no ghost cleanup)', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.otpCode.updateMany.mockResolvedValue({ count: 0 });
      prisma.otpCode.create.mockResolvedValue({ id: 'otp-1' });
      sms.sendOtp.mockResolvedValue({ success: false });

      await expect(service.sendOtp(dto)).rejects.toThrow(ServiceUnavailableException);
      expect(prisma.user.delete).not.toHaveBeenCalled();
    });
  });

  // ── verifyOtp ────────────────────────────────────────────────────────────────

  describe('verifyOtp', () => {
    const dto = { phone: '+2348012345678', code: '123456' };

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(mockUser);
      prisma.otpCode.findFirst.mockResolvedValue(mockOtp);
      prisma.otpCode.update.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({ id: 'rt-1' });
      prisma.userProfile.findUnique.mockResolvedValue({
        firstName: 'Emeka', lastName: 'Okafor', displayName: 'Emeka Okafor',
        avatarUrl: null, city: 'Lagos', isProvider: false,
      });
    });

    it('verifies correct OTP and returns tokens + user for returning user', async () => {
      const result = await service.verifyOtp(dto);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.isNewUser).toBe(false);
      expect(result.user.id).toBe(mockUser.id);
      expect(result.user.isPhoneVerified).toBe(true);
    });

    it('returns isNewUser=true for unverified account', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, isPhoneVerified: false });

      const result = await service.verifyOtp(dto);

      expect(result.isNewUser).toBe(true);
    });

    it('throws BadRequestException when phone not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.verifyOtp(dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when no valid OTP exists', async () => {
      prisma.otpCode.findFirst.mockResolvedValue(null);

      await expect(service.verifyOtp(dto)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when OTP attempts exhausted', async () => {
      prisma.otpCode.findFirst.mockResolvedValue({ ...mockOtp, attempts: 5 });

      await expect(service.verifyOtp(dto)).rejects.toThrow(BadRequestException);
    });

    it('increments attempts and throws when code is wrong', async () => {
      prisma.otpCode.findFirst.mockResolvedValue({ ...mockOtp, code: '999999' });

      await expect(service.verifyOtp({ ...dto, code: 'wrong1' })).rejects.toThrow(BadRequestException);
      expect(prisma.otpCode.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { attempts: { increment: 1 } } }),
      );
    });

    it('throws UnauthorizedException for suspended user', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, isSuspended: true });

      await expect(service.verifyOtp(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('upserts device record when deviceId is provided', async () => {
      prisma.userDevice.upsert.mockResolvedValue({});
      const dtoWithDevice = { ...dto, deviceId: 'device-abc', deviceType: 'mobile', fcmToken: 'fcm-token-1' };

      await service.verifyOtp(dtoWithDevice);

      expect(prisma.userDevice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_deviceId: { userId: mockUser.id, deviceId: 'device-abc' } },
        }),
      );
    });

    it('marks OTP as used and activates account in a transaction', async () => {
      await service.verifyOtp(dto);

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  // ── refreshTokens ────────────────────────────────────────────────────────────

  describe('refreshTokens', () => {
    const rawToken = 'raw-refresh-token';

    beforeEach(() => {
      (jwtService.verify as jest.Mock).mockReturnValue({ sub: mockUser.id });
      prisma.refreshToken.findMany.mockResolvedValue([
        { id: 'rt-1', userId: mockUser.id, tokenHash: 'hash', isRevoked: false, expiresAt: new Date(Date.now() + 86400000), deviceId: null },
      ]);
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.refreshToken.create.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue({ phone: mockUser.phone, role: mockUser.role, isActive: true });
    });

    it('issues new tokens when refresh token is valid', async () => {
      const result = await service.refreshTokens(rawToken);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('revokes old refresh token before issuing new one', async () => {
      await service.refreshTokens(rawToken);

      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isRevoked: true } }),
      );
    });

    it('throws UnauthorizedException when JWT verification fails', async () => {
      (jwtService.verify as jest.Mock).mockImplementation(() => { throw new Error('expired'); });

      await expect(service.refreshTokens(rawToken)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when no matching stored token found', async () => {
      encryption.compareToken.mockResolvedValue(false);

      await expect(service.refreshTokens(rawToken)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user is inactive', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });

      await expect(service.refreshTokens(rawToken)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── logout ───────────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('revokes specific token when rawRefreshToken is provided, and deactivates its device', async () => {
      prisma.refreshToken.findMany.mockResolvedValue([
        { id: 'rt-1', tokenHash: 'hash', isRevoked: false, deviceId: 'device-1' },
      ]);
      prisma.refreshToken.update.mockResolvedValue({});
      prisma.userDevice.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.logout(mockUser.id, 'raw-token');

      expect(prisma.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isRevoked: true } }),
      );
      expect(prisma.userDevice.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id, deviceId: 'device-1' },
        data: { isActive: false },
      });
      expect(result.message).toMatch(/logged out/i);
    });

    it('revokes all tokens and deactivates all devices when no rawRefreshToken provided', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });
      prisma.userDevice.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.logout(mockUser.id);

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: mockUser.id }, data: { isRevoked: true } }),
      );
      expect(prisma.userDevice.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        data: { isActive: false },
      });
      expect(result.message).toMatch(/logged out/i);
    });
  });
});
