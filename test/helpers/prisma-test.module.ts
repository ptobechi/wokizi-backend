import { Module } from '@nestjs/common';
import { PrismaTestService } from './prisma-test.service';

@Module({
  providers: [PrismaTestService],
  exports: [PrismaTestService],
})
export class PrismaTestModule {}
