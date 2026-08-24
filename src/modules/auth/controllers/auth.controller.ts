import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../services/auth.service';
import { SendOtpDto } from '../dto/requests/send-otp.dto';
import { VerifyPhoneOtpDto } from '../dto/requests/verify-phone-otp.dto';
import { LoginDto } from '../dto/requests/login.dto';
import { SendOtpResponseDto, VerifyOtpResponseDto, RefreshResponseDto, AdminLoginResponseDto } from '../dto/responses/auth.response';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';

// ─────────────────────────────────────────────────────────────────────────────
// Auth Flow:
//
//   1. POST /auth/send-otp   { phone }
//      → Sends 6-digit OTP via SMS. Returns isNewUser flag.
//
//   2. POST /auth/verify-otp { phone, code, deviceId?, fcmToken? }
//      → Validates OTP. Auto-creates account if new number.
//         Returns { accessToken, refreshToken, user, isNewUser }.
//
//   3. POST /auth/refresh    { refreshToken }
//      → Rotates refresh token, returns new token pair.
//
//   4. POST /auth/logout     { refreshToken? } (authenticated)
//      → Revokes the specific refresh token (or all if omitted).
// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('send-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 5 } }) // max 5 OTP requests per minute per IP
  @ApiOperation({
    summary: 'Step 1 — Request a phone OTP',
    description:
      'Sends a 6-digit SMS code to the given phone number. ' +
      'If the number is not registered, a ghost account is created and activated only after OTP verification. ' +
      'isNewUser=true means the frontend should show a "welcome, new user" message.',
  })
  @ApiResponse({ status: 200, type: SendOtpResponseDto })
  sendOtp(@Body() dto: SendOtpDto): Promise<SendOtpResponseDto> {
    return this.authService.sendOtp(dto);
  }

  @Public()
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Step 2 — Verify OTP and receive tokens',
    description:
      'Verifies the 6-digit OTP. ' +
      'If the code is correct the account is activated (new user) or accessed (returning user). ' +
      'Returns access + refresh tokens along with the user object immediately — ' +
      'no separate registration step is needed.',
  })
  @ApiResponse({ status: 200, type: VerifyOtpResponseDto })
  verifyOtp(@Body() dto: VerifyPhoneOtpDto): Promise<VerifyOtpResponseDto> {
    return this.authService.verifyOtp(dto);
  }

  @Public()
  @Post('admin/login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } }) // max 10 login attempts per minute per IP
  @ApiOperation({
    summary: 'Admin dashboard login — email + password',
    description:
      'Separate credential flow reserved for ADMIN/SUPER_ADMIN accounts. ' +
      'Regular app users never use this — they authenticate via phone + OTP.',
  })
  @ApiResponse({ status: 200, type: AdminLoginResponseDto })
  adminLogin(@Body() dto: LoginDto): Promise<AdminLoginResponseDto> {
    return this.authService.adminLogin(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rotate refresh token',
    description: 'Supply the current refresh token to receive a new access + refresh token pair. The old refresh token is revoked.',
  })
  @ApiResponse({ status: 200, type: RefreshResponseDto })
  refresh(@Body() body: { refreshToken: string }): Promise<RefreshResponseDto> {
    return this.authService.refreshTokens(body.refreshToken);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('access-token')
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Logout',
    description: 'Revokes the given refresh token. Omit refreshToken body to revoke ALL sessions for this user.',
  })
  logout(
    @CurrentUser('id') userId: string,
    @Body() body: { refreshToken?: string },
  ) {
    return this.authService.logout(userId, body.refreshToken);
  }
}
