import { Module } from '@nestjs/common';
import { VerificationService } from './services/verification.service';
import { VerificationController } from './controllers/verification.controller';
import { VerificationRepository } from './repositories/verification.repository';

@Module({
  controllers: [VerificationController],
  providers: [VerificationService, VerificationRepository],
  exports: [VerificationService],
})
export class VerificationModule {}
