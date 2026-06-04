import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OtpType } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { EncryptionService } from '../../../core/security/encryption.service';
import { SmsService } from '../../../integrations/sms/sms.service';
import { SendOtpDto } from '../dto/requests/send-otp.dto';
import { VerifyPhoneOtpDto } from '../dto/requests/verify-phone-otp.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private encryption: EncryptionService,
    private sms: SmsService,
  ) {}

  // ─── Step 1: Request OTP ─────────────────────────────────────────────────
  // The caller does not need to know whether the phone is registered yet.
  // We check internally and return isNewUser so the frontend can tailor its
  // welcome copy.  Account creation only finalises after OTP verification.
  // ─────────────────────────────────────────────────────────────────────────
  async sendOtp(dto: SendOtpDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      select: { id: true, isPhoneVerified: true },
    });

    const isNewUser = !existingUser || !existingUser.isPhoneVerified;

    const code = this.encryption.generateOtp(6);
    const expiresAt = this.encryption.getOtpExpiry(
      this.configService.get<number>('app.otpExpiresMinutes', 10),
    );

    let userId = existingUser?.id;

    if (!userId) {
      // Create an inactive "ghost" user so we have a userId to attach the OTP to.
      // The user only becomes active (isActive: true) after successful OTP verify.
      const ghost = await this.prisma.user.create({
        data: {
          phone: dto.phone,
          isActive: false,
          isPhoneVerified: false,
          profile: { create: {} },
          notificationPrefs: { create: {} },
        },
        select: { id: true },
      });
      userId = ghost.id;
    } else {
      // Invalidate any previous unused OTPs for this phone
      await this.prisma.otpCode.updateMany({
        where: { userId, type: OtpType.PHONE_AUTH, isUsed: false },
        data: { isUsed: true },
      });
    }

    await this.prisma.otpCode.create({
      data: { userId, code, type: OtpType.PHONE_AUTH, expiresAt },
    });

    const result = await this.sms.sendOtp(dto.phone, code);

    if (!result.success) {
      // Clean up ghost user if we created one and SMS failed
      if (!existingUser) {
        await this.prisma.user.delete({ where: { id: userId } }).catch(() => {});
      }
      throw new ServiceUnavailableException('SMS delivery failed. Please try again.');
    }

    return { message: 'OTP sent successfully', isNewUser };
  }

  // ─── Step 2: Verify OTP → login or activate account ──────────────────────
  // Single endpoint for both returning users and new registrations.
  // Returns access + refresh tokens immediately so the user goes straight to
  // the home screen — no separate "complete registration" step required.
  // ─────────────────────────────────────────────────────────────────────────
  async verifyOtp(dto: VerifyPhoneOtpDto) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      select: { id: true, role: true, isActive: true, isSuspended: true, isPhoneVerified: true },
    });

    if (!user) throw new BadRequestException('Phone number not found. Request a new OTP first.');

    const maxAttempts = this.configService.get<number>('app.otpMaxAttempts', 5);

    const otp = await this.prisma.otpCode.findFirst({
      where: {
        userId: user.id,
        type: OtpType.PHONE_AUTH,
        isUsed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otp) throw new BadRequestException('OTP expired or not found. Request a new code.');

    if (otp.attempts >= maxAttempts) {
      throw new BadRequestException('Too many incorrect attempts. Request a new code.');
    }

    if (otp.code !== dto.code) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      const remaining = maxAttempts - otp.attempts - 1;
      throw new BadRequestException(
        `Incorrect code. ${remaining} ${remaining === 1 ? 'attempt' : 'attempts'} remaining.`,
      );
    }

    if (user.isSuspended) throw new UnauthorizedException('Account suspended. Contact support.');

    // Determine if this was a new registration (account not yet active/verified)
    const isNewUser = !user.isPhoneVerified;

    // Activate account + mark OTP used in one transaction
    await this.prisma.$transaction([
      this.prisma.otpCode.update({ where: { id: otp.id }, data: { isUsed: true } }),
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          isActive: true,
          isPhoneVerified: true,
          lastLoginAt: new Date(),
          failedLoginAttempts: 0,
        },
      }),
    ]);

    // Register or update device record for push notifications
    if (dto.deviceId) {
      await this.prisma.userDevice.upsert({
        where: { userId_deviceId: { userId: user.id, deviceId: dto.deviceId } },
        update: { fcmToken: dto.fcmToken ?? null, lastSeenAt: new Date() },
        create: {
          userId: user.id,
          deviceId: dto.deviceId,
          deviceType: dto.deviceType ?? 'mobile',
          fcmToken: dto.fcmToken,
        },
      });
    }

    const tokens = await this.issueTokens(user.id, dto.phone, user.role, dto.deviceId);

    const profile = await this.prisma.userProfile.findUnique({
      where: { userId: user.id },
      select: { firstName: true, lastName: true, displayName: true, avatarUrl: true, city: true, isProvider: true },
    });

    return {
      ...tokens,
      isNewUser,
      user: {
        id: user.id,
        phone: dto.phone,
        role: user.role,
        isPhoneVerified: true,
        profile,
      },
    };
  }

  // ─── Refresh Tokens ───────────────────────────────────────────────────────
  async refreshTokens(rawRefreshToken: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(rawRefreshToken, {
        secret: this.configService.get('jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const userId = payload?.sub;
    if (!userId) throw new UnauthorizedException('Invalid token payload');

    const storedTokens = await this.prisma.refreshToken.findMany({
      where: { userId, isRevoked: false, expiresAt: { gt: new Date() } },
    });

    let validToken: (typeof storedTokens)[number] | undefined;
    for (const t of storedTokens) {
      if (await this.encryption.compareToken(rawRefreshToken, t.tokenHash)) {
        validToken = t;
        break;
      }
    }

    if (!validToken) throw new UnauthorizedException('Refresh token not found or revoked');

    // Rotate: revoke old, issue new
    await this.prisma.refreshToken.update({
      where: { id: validToken.id },
      data: { isRevoked: true },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) throw new UnauthorizedException('Account not found or inactive');

    return this.issueTokens(userId, user.phone, user.role, validToken.deviceId ?? undefined);
  }

  // ─── Logout ───────────────────────────────────────────────────────────────
  async logout(userId: string, rawRefreshToken?: string) {
    if (rawRefreshToken) {
      const tokens = await this.prisma.refreshToken.findMany({
        where: { userId, isRevoked: false },
      });
      for (const t of tokens) {
        if (await this.encryption.compareToken(rawRefreshToken, t.tokenHash)) {
          await this.prisma.refreshToken.update({
            where: { id: t.id },
            data: { isRevoked: true },
          });
          break;
        }
      }
    } else {
      await this.prisma.refreshToken.updateMany({ where: { userId }, data: { isRevoked: true } });
    }
    return { message: 'Logged out successfully' };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────
  private async issueTokens(userId: string, phone: string, role: string, deviceId?: string) {
    const payload = { sub: userId, phone, role };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.accessSecret'),
      expiresIn: this.configService.get('jwt.accessExpiresIn', '15m'),
    });

    const rawRefresh = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.refreshSecret'),
      expiresIn: this.configService.get('jwt.refreshExpiresIn', '30d'),
    });

    const tokenHash = await this.encryption.hashToken(rawRefresh);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, deviceId, expiresAt },
    });

    return { accessToken, refreshToken: rawRefresh };
  }
}
