import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from '../services/users.service';

const mockUsersService = {
  getMe: jest.fn(),
  updateMe: jest.fn(),
  getPublicProfile: jest.fn(),
  getSessions: jest.fn(),
  revokeSession: jest.fn(),
  revokeAllSessions: jest.fn(),
  deactivate: jest.fn(),
};

describe('UsersController', () => {
  let controller: UsersController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockUsersService }],
    }).compile();
    controller = module.get(UsersController);
  });

  describe('getMe', () => {
    it('returns current user profile', async () => {
      const user = { id: 'u1', phone: '+2348012345678', profile: { firstName: 'Ada' } };
      mockUsersService.getMe.mockResolvedValue(user);

      const result = await controller.getMe('u1');

      expect(mockUsersService.getMe).toHaveBeenCalledWith('u1');
      expect(result).toEqual(user);
    });
  });

  describe('updateMe', () => {
    it('updates email and returns updated user', async () => {
      const dto = { email: 'ada@example.com' };
      const updated = { id: 'u1', email: 'ada@example.com' };
      mockUsersService.updateMe.mockResolvedValue(updated);

      const result = await controller.updateMe('u1', dto);

      expect(mockUsersService.updateMe).toHaveBeenCalledWith('u1', dto);
      expect(result).toEqual(updated);
    });
  });

  describe('getPublicProfile', () => {
    it('returns public profile for any user id', async () => {
      const profile = { id: 'u2', displayName: 'Emeka' };
      mockUsersService.getPublicProfile.mockResolvedValue(profile);

      const result = await controller.getPublicProfile('u2');

      expect(mockUsersService.getPublicProfile).toHaveBeenCalledWith('u2');
      expect(result).toEqual(profile);
    });
  });

  describe('getSessions', () => {
    it('returns active device sessions', async () => {
      const sessions = [{ deviceId: 'd1', platform: 'ios' }];
      mockUsersService.getSessions.mockResolvedValue(sessions);

      const result = await controller.getSessions('u1');

      expect(mockUsersService.getSessions).toHaveBeenCalledWith('u1');
      expect(result).toEqual(sessions);
    });
  });

  describe('revokeSession', () => {
    it('revokes a specific device session', async () => {
      mockUsersService.revokeSession.mockResolvedValue({ success: true });

      await controller.revokeSession('u1', 'd1');

      expect(mockUsersService.revokeSession).toHaveBeenCalledWith('u1', 'd1');
    });
  });

  describe('revokeAllSessions', () => {
    it('passes current device id to service to preserve it', async () => {
      mockUsersService.revokeAllSessions.mockResolvedValue({ revoked: 3 });

      await controller.revokeAllSessions('u1', 'd-current');

      expect(mockUsersService.revokeAllSessions).toHaveBeenCalledWith('u1', 'd-current');
    });
  });

  describe('deactivate', () => {
    it('deactivates the current user account', async () => {
      mockUsersService.deactivate.mockResolvedValue({ success: true });

      await controller.deactivate('u1');

      expect(mockUsersService.deactivate).toHaveBeenCalledWith('u1');
    });
  });
});
