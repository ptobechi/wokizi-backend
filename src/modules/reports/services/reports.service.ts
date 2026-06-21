import { BadRequestException, Injectable } from '@nestjs/common';
import { ReportTargetType } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async reportContent(reportedById: string, payload: {
    targetType: string;
    targetId: string;
    reason: string;
  }) {
    if (!Object.values(ReportTargetType).includes(payload.targetType as ReportTargetType)) {
      throw new BadRequestException(`Invalid targetType. Must be one of: ${Object.values(ReportTargetType).join(', ')}`);
    }
    if (!payload.reason?.trim()) {
      throw new BadRequestException('Report reason is required');
    }

    const report = await this.prisma.contentReport.create({
      data: {
        reportedById,
        targetType: payload.targetType as ReportTargetType,
        targetId:   payload.targetId,
        reason:     payload.reason.trim(),
      },
    });

    return { message: 'Report submitted successfully', reportId: report.id };
  }
}
