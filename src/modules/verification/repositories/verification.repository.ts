import { Injectable } from '@nestjs/common';
import { VerificationStatus } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { BaseRepository } from '../../../core/prisma/base.repository';

@Injectable()
export class VerificationRepository extends BaseRepository {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  findByUserId(userId: string) {
    return this.prisma.verification.findUnique({ where: { userId }, include: { documents: true } });
  }

  findById(id: string) {
    return this.prisma.verification.findUnique({ where: { id }, include: { user: true, documents: true } });
  }

  upsert(userId: string, documents: any[]) {
    return this.prisma.verification.upsert({
      where: { userId },
      update: {
        status: VerificationStatus.PENDING,
        submittedAt: new Date(),
        reviewedAt: null,
        reviewedBy: null,
        reviewNotes: null,
        rejectionReason: null,
        documents: { deleteMany: {}, create: documents },
      },
      create: { userId, status: VerificationStatus.PENDING, documents: { create: documents } },
      include: { documents: true },
    });
  }

  review(id: string, reviewerId: string, status: VerificationStatus, notes?: string, reason?: string) {
    return this.prisma.verification.update({
      where: { id },
      data: {
        status,
        reviewedAt: new Date(),
        reviewedBy: reviewerId,
        reviewNotes: notes,
        rejectionReason: reason,
      },
    });
  }

  listPending(skip: number, take: number) {
    return this.prisma.verification.findMany({
      where: { status: VerificationStatus.PENDING },
      include: { user: { include: { profile: true } }, documents: true },
      skip,
      take,
      orderBy: { submittedAt: 'asc' },
    });
  }

  countPending() {
    return this.prisma.verification.count({ where: { status: VerificationStatus.PENDING } });
  }
}
