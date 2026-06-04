import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ProfilesService } from '../../profiles/services/profiles.service';
import { EventName } from '../../../common/enums';

@Injectable()
export class AnalyticsListener {
  constructor(private profilesService: ProfilesService) {}

  @OnEvent(EventName.PROVIDER_METRICS_UPDATE)
  async handleMetricsUpdate({ providerId }: { providerId: string }) {
    await this.profilesService.updateProviderMetrics(providerId);
  }
}
