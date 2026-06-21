import { UserRole, UserStatus } from '@prisma/client';
import { v4 as uuid } from 'uuid';

export function buildUser(overrides: Record<string, any> = {}) {
  return {
    id: uuid(),
    phone: `+234${Math.floor(8000000000 + Math.random() * 1000000000)}`,
    email: null,
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    isPhoneVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

export function buildProfile(userId: string, overrides: Record<string, any> = {}) {
  return {
    id: uuid(),
    userId,
    firstName: 'Test',
    lastName: 'User',
    displayName: 'Test User',
    avatarUrl: null,
    bio: null,
    isProvider: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildAdmin(overrides: Record<string, any> = {}) {
  return buildUser({ role: UserRole.ADMIN, ...overrides });
}

export function buildProvider(overrides: Record<string, any> = {}) {
  return buildUser({ ...overrides });
}
