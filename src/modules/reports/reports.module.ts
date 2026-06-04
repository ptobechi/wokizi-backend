import { Module } from '@nestjs/common';
import { ReportsService } from './services/reports.service';
import { ReportsController } from './controllers/reports.controller';

@Module({ controllers: [ReportsController], providers: [ReportsService] })
export class ReportsModule {}
