import { Module } from '@nestjs/common';
import { PortfoliosService } from './services/portfolios.service';
import { PortfoliosController } from './controllers/portfolios.controller';
import { PortfoliosRepository } from './repositories/portfolios.repository';

@Module({
  controllers: [PortfoliosController],
  providers: [PortfoliosService, PortfoliosRepository],
  exports: [PortfoliosService],
})
export class PortfoliosModule {}
