import { Module } from '@nestjs/common';
import { HealthController } from './controllers/health.controller';
import { DatabaseHealthIndicator } from '../../core/monitoring/health.indicator';

@Module({
  controllers: [HealthController],
  providers: [DatabaseHealthIndicator],
})
export class HealthModule {}
