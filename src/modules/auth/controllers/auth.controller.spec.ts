import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from '../services/auth.service';

const mockAuthService = {
  sendOtp: jest.fn(),
  verifyOtp: jest.fn(),
  refreshTokens: jest.fn(),
  logout: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();
    controller = module.get(AuthController);
  });

  describe('sendOtp', () => {
    it('delegates to authService.sendOtp and returns the result', async () => {
      const dto = { phone: '+2348012345678' };
      const response = { isNewUser: false, message: 'OTP sent' };
      mockAuthService.sendOtp.mockResolvedValue(response);

      const result = await controller.sendOtp(dto as any);

      expect(mockAuthService.sendOtp).toHaveBeenCalledWith(dto);
      expect(result).toEqual(response);
    });
  });

  describe('verifyOtp', () => {
    it('delegates to authService.verifyOtp and returns tokens + user', async () => {
      const dto = { phone: '+2348012345678', code: '123456' };
      const response = { accessToken: 'at', refreshToken: 'rt', user: { id: 'u1' }, isNewUser: false };
      mockAuthService.verifyOtp.mockResolvedValue(response);

      const result = await controller.verifyOtp(dto as any);

      expect(mockAuthService.verifyOtp).toHaveBeenCalledWith(dto);
      expect(result).toEqual(response);
    });
  });

  describe('refresh', () => {
    it('delegates to authService.refreshTokens with the refresh token', async () => {
      const body = { refreshToken: 'old-rt' };
      const response = { accessToken: 'new-at', refreshToken: 'new-rt' };
      mockAuthService.refreshTokens.mockResolvedValue(response);

      const result = await controller.refresh(body);

      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith('old-rt');
      expect(result).toEqual(response);
    });
  });

  describe('logout', () => {
    it('calls logout with userId and specific refresh token', async () => {
      mockAuthService.logout.mockResolvedValue({ success: true });

      await controller.logout('user-1', { refreshToken: 'rt' });

      expect(mockAuthService.logout).toHaveBeenCalledWith('user-1', 'rt');
    });

    it('calls logout with undefined refreshToken to revoke all sessions', async () => {
      mockAuthService.logout.mockResolvedValue({ success: true });

      await controller.logout('user-1', {});

      expect(mockAuthService.logout).toHaveBeenCalledWith('user-1', undefined);
    });
  });
});
