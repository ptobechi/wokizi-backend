import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { VerificationService } from '../services/verification.service';
import { SubmitVerificationDto } from '../dto/requests/submit-verification.dto';
import { ReviewVerificationDto } from '../dto/requests/review-verification.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { ParseUUIDPipe } from '../../../common/pipes/parse-uuid.pipe';

@ApiTags('Verification')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
@Controller('verification')
export class VerificationController {
  constructor(private verificationService: VerificationService) {}

  @Post('submit')
  @ApiOperation({ summary: 'Submit verification documents' })
  submit(@CurrentUser('id') userId: string, @Body() dto: SubmitVerificationDto) {
    return this.verificationService.submit(userId, dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get my verification status' })
  getMyVerification(@CurrentUser('id') userId: string) {
    return this.verificationService.getMyVerification(userId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Get('pending')
  @ApiOperation({ summary: '[Admin] List pending verifications' })
  listPending(@Query('page') page: number, @Query('limit') limit: number) {
    return this.verificationService.listPending(page, limit);
  }

  @UseGuards(RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @Patch(':id/review')
  @ApiOperation({ summary: '[Admin] Approve or reject verification' })
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') reviewerId: string,
    @Body() dto: ReviewVerificationDto,
  ) {
    return this.verificationService.review(id, reviewerId, dto);
  }
}
