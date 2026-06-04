import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { DatabaseHealthIndicator } from '../../../core/monitoring/health.indicator';
import { Public } from '../../../common/decorators/public.decorator';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private dbHealth: DatabaseHealthIndicator) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check' })
  async check() {
    const db = await this.dbHealth.isHealthy();
    return {
      status: db.status === 'up' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: { database: db },
    };
  }
}
