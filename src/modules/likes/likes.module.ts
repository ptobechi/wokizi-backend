import { Module } from '@nestjs/common';
import { LikesService } from './services/likes.service';
import { LikesController } from './controllers/likes.controller';

@Module({ controllers: [LikesController], providers: [LikesService], exports: [LikesService] })
export class LikesModule {}
