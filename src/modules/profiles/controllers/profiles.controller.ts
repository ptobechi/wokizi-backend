import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProfilesService } from '../services/profiles.service';
import { UpdateProfileDto } from '../dto/requests/update-profile.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Profiles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('profiles')
export class ProfilesController {
  constructor(private profilesService: ProfilesService) {}

  @Patch('me')
  @ApiOperation({ summary: 'Update my profile' })
  update(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.profilesService.update(userId, dto);
  }

  @Get('me/stats')
  @ApiOperation({ summary: 'Get my provider stats' })
  getStats(@CurrentUser('id') userId: string) {
    return this.profilesService.getStats(userId);
  }
}
