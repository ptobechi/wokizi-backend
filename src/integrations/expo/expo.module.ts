import { Global, Module } from '@nestjs/common';
import { ExpoService } from './expo.service';

@Global()
@Module({
  providers: [ExpoService],
  exports: [ExpoService],
})
export class ExpoModule {}
