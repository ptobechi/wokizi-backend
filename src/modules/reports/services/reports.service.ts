import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async reportContent(reportedBy: string, payload: { targetType: string; targetId: string; reason: string }) {
    // Placeholder — wire to content_reports table when schema supports it
    return { message: 'Report submitted', ...payload };
  }
}
