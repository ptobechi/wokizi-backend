import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { VerificationStatus } from '@prisma/client';
import { VerificationRepository } from '../repositories/verification.repository';
import { SubmitVerificationDto } from '../dto/requests/submit-verification.dto';
import { ReviewVerificationDto } from '../dto/requests/review-verification.dto';
import { EventName } from '../../../common/enums';

@Injectable()
export class VerificationService {
  constructor(
    private repo: VerificationRepository,
    private eventEmitter: EventEmitter2,
  ) {}

  async submit(userId: string, dto: SubmitVerificationDto) {
    const existing = await this.repo.findByUserId(userId);

    if (existing?.status === VerificationStatus.APPROVED) throw new BadRequestException('Already verified');
    if (existing?.status === VerificationStatus.PENDING) throw new BadRequestException('Verification already under review');

    const verification = await this.repo.upsert(userId, dto.documents);

    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId,
      type: 'VERIFICATION_SUBMITTED',
    });

    return verification;
  }

  async getMyVerification(userId: string) {
    const v = await this.repo.findByUserId(userId);
    return v ?? { status: null, message: 'Not submitted' };
  }

  async review(verificationId: string, reviewerId: string, dto: ReviewVerificationDto) {
    const v = await this.repo.findById(verificationId);
    if (!v) throw new NotFoundException('Verification not found');
    if (v.status !== VerificationStatus.PENDING) throw new BadRequestException('Not in PENDING status');
    if (dto.status === 'REJECTED' && !dto.rejectionReason) throw new BadRequestException('Rejection reason required');

    const status = dto.status === 'APPROVED' ? VerificationStatus.APPROVED : VerificationStatus.REJECTED;
    const updated = await this.repo.review(verificationId, reviewerId, status, dto.reviewNotes, dto.rejectionReason);

    this.eventEmitter.emit(EventName.NOTIFICATION_SEND, {
      userId: (v as any).user.id,
      type:   status === VerificationStatus.APPROVED ? 'VERIFICATION_APPROVED' : 'VERIFICATION_REJECTED',
      ctx:    { rejectionReason: dto.rejectionReason },
    });

    return updated;
  }

  async listPending(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.repo.listPending(skip, limit),
      this.repo.countPending(),
    ]);
    return { data, total };
  }
}
