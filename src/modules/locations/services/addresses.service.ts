import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from '../dto/address.dto';

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  async list(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async create(userId: string, dto: CreateAddressDto) {
    return this.prisma.$transaction(async (tx) => {
      // If setting as default, clear all other defaults first
      if (dto.isDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data:  { isDefault: false },
        });
      }

      // If this is the user's first address, make it default automatically
      const count = await tx.address.count({ where: { userId } });
      const isDefault = dto.isDefault ?? count === 0;

      return tx.address.create({
        data: { ...dto, userId, isDefault },
      });
    });
  }

  async update(userId: string, addressId: string, dto: UpdateAddressDto) {
    const existing = await this.prisma.address.findUnique({ where: { id: addressId } });
    if (!existing) throw new NotFoundException('Address not found');
    if (existing.userId !== userId) throw new ForbiddenException();

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true, id: { not: addressId } },
          data:  { isDefault: false },
        });
      }
      return tx.address.update({ where: { id: addressId }, data: dto });
    });
  }

  async remove(userId: string, addressId: string) {
    const existing = await this.prisma.address.findUnique({ where: { id: addressId } });
    if (!existing) throw new NotFoundException('Address not found');
    if (existing.userId !== userId) throw new ForbiddenException();

    await this.prisma.address.delete({ where: { id: addressId } });

    // If the deleted address was default, promote the oldest remaining address
    if (existing.isDefault) {
      const next = await this.prisma.address.findFirst({
        where:   { userId },
        orderBy: { createdAt: 'asc' },
      });
      if (next) {
        await this.prisma.address.update({ where: { id: next.id }, data: { isDefault: true } });
      }
    }

    return { deleted: true };
  }

  async setDefault(userId: string, addressId: string) {
    const existing = await this.prisma.address.findUnique({ where: { id: addressId } });
    if (!existing) throw new NotFoundException('Address not found');
    if (existing.userId !== userId) throw new ForbiddenException();

    await this.prisma.address.updateMany({
      where: { userId, isDefault: true },
      data:  { isDefault: false },
    });
    return this.prisma.address.update({ where: { id: addressId }, data: { isDefault: true } });
  }
}
