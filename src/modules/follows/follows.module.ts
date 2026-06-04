import { Module } from '@nestjs/common';
import { FollowsService } from './services/follows.service';
import { FollowsController } from './controllers/follows.controller';
import { FollowsRepository } from './repositories/follows.repository';

@Module({ controllers: [FollowsController], providers: [FollowsService, FollowsRepository], exports: [FollowsService] })
export class FollowsModule {}
