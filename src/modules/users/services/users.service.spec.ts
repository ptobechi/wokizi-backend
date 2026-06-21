import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersRepository } from '../repositories/users.repository';
import { PrismaService } from '../../../core/prisma/prisma.service';

const USER_ID   = 'user-uuid-1';
const DEVICE_ID = 'device-uuid-1';

const mockUser = {
  id:        USER_ID,
  phone:     '+2348012345678',
  email:     null,
  role:      'USER',
  isActive:  true,
  createdAt: new Date(),
};

describe('UsersService', () => {
  let service: UsersService;
  let repo: any;
  let prisma: any;

  beforeEach(async () => {
    repo = {
      findById:        jest.fn(),
      findPublicProfile: jest.fn(),
      deactivate:      jest.fn(),
    };

    prisma = {
      user: {
        findUnique: jest.fn(),
        update:     jest.fn(),
      },
      userDevice: {
        findMany:    jest.fn(),
        updateMany:  jest.fn(),
      },
      refreshToken: {
        updateMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: repo },
        { provide: PrismaService,   useValue: prisma },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => jest.clearAllMocks());

  // ── getMe ─────────────────────────────────────────────────────────────────

  describe('getMe', () => {
    it('returns the authenticated user', async () => {
      repo.findById.mockResolvedValue(mockUser);
      const result = await service.getMe(USER_ID);
      expect(result).toEqual(mockUser);
    });

    it('throws NotFoundException when user not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.getMe('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── getPublicProfile ──────────────────────────────────────────────────────

  describe('getPublicProfile', () => {
    it('returns public profile', async () => {
      repo.findPublicProfile.mockResolvedValue({ ...mockUser, profile: { displayName: 'Emeka' } });
      const result = await service.getPublicProfile(USER_ID);
      expect(result).toHaveProperty('profile');
    });

    it('throws NotFoundException when user not found', async () => {
      repo.findPublicProfile.mockResolvedValue(null);
      await expect(service.getPublicProfile('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ── updateMe ──────────────────────────────────────────────────────────────

  describe('updateMe', () => {
    it('updates email when not taken', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.update.mockResolvedValue({ ...mockUser, email: 'new@example.com' });

      const result = await service.updateMe(USER_ID, { email: 'new@example.com' });
      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: USER_ID },
        data:  { email: 'new@example.com' },
      }));
    });

    it('allows user to update with their own current email', async () => {
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, id: USER_ID, email: 'same@example.com' });
      prisma.user.update.mockResolvedValue({ ...mockUser, email: 'same@example.com' });

      await service.updateMe(USER_ID, { email: 'same@example.com' });
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('throws ConflictException when email belongs to another user', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'other-user', email: 'taken@example.com' });
      await expect(service.updateMe(USER_ID, { email: 'taken@example.com' }))
        .rejects.toThrow(ConflictException);
    });

    it('updates user without touching email when no email provided', async () => {
      prisma.user.update.mockResolvedValue(mockUser);
      await service.updateMe(USER_ID, {});
      expect(prisma.user.update).toHaveBeenCalledWith(expect.objectContaining({
        data: {},
      }));
    });
  });

  // ── getSessions ───────────────────────────────────────────────────────────

  describe('getSessions', () => {
    it('returns active sessions for user', async () => {
      const sessions = [{ id: 'sess-1', deviceId: DEVICE_ID, isActive: true }];
      prisma.userDevice.findMany.mockResolvedValue(sessions);

      const result = await service.getSessions(USER_ID);
      expect(result).toEqual(sessions);
      expect(prisma.userDevice.findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: USER_ID, isActive: true },
      }));
    });
  });

  // ── revokeSession ─────────────────────────────────────────────────────────

  describe('revokeSession', () => {
    it('revokes a specific device session and its refresh tokens', async () => {
      prisma.userDevice.updateMany.mockResolvedValue({ count: 1 });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.revokeSession(USER_ID, DEVICE_ID);
      expect(result).toEqual({ message: 'Session revoked' });
      expect(prisma.userDevice.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { userId: USER_ID, deviceId: DEVICE_ID },
        data:  { isActive: false },
      }));
    });
  });

  // ── revokeAllSessions ─────────────────────────────────────────────────────

  describe('revokeAllSessions', () => {
    it('revokes all sessions', async () => {
      prisma.userDevice.updateMany.mockResolvedValue({ count: 3 });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.revokeAllSessions(USER_ID);
      expect(result).toEqual({ message: 'All other sessions revoked' });
    });

    it('excludes current device when currentDeviceId is provided', async () => {
      prisma.userDevice.updateMany.mockResolvedValue({ count: 2 });
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await service.revokeAllSessions(USER_ID, DEVICE_ID);
      expect(prisma.userDevice.updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ deviceId: { not: DEVICE_ID } }),
      }));
    });
  });

  // ── deactivate ────────────────────────────────────────────────────────────

  describe('deactivate', () => {
    it('deactivates the user account', async () => {
      repo.deactivate.mockResolvedValue({});
      const result = await service.deactivate(USER_ID);
      expect(result).toEqual({ message: 'Account deactivated' });
      expect(repo.deactivate).toHaveBeenCalledWith(USER_ID);
    });
  });
});
