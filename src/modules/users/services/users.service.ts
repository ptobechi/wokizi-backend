import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { UsersRepository } from '../repositories/users.repository';

export class UpdateUserEmailDto {
  email?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private repo: UsersRepository,
    private prisma: PrismaService,
  ) {}

  async getMe(userId: string) {
    const user = await this.repo.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async getPublicProfile(id: string) {
    const user = await this.repo.findPublicProfile(id);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  // Allows updating optional fields on the User model (email only for now).
  // Profile fields (name, avatar, etc.) are updated via PATCH /profiles/me.
  async updateMe(userId: string, dto: UpdateUserEmailDto) {
    if (dto.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing && existing.id !== userId) {
        throw new ConflictException('This email address is already associated with another account');
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { ...(dto.email !== undefined ? { email: dto.email } : {}) },
      select: { id: true, phone: true, email: true, role: true },
    });
  }

  async deactivate(userId: string) {
    await this.repo.deactivate(userId);
    return { message: 'Account deactivated' };
  }
}
