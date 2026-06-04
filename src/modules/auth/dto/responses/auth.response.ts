import { ApiProperty } from '@nestjs/swagger';

export class SendOtpResponseDto {
  @ApiProperty()
  message: string;

  @ApiProperty({ description: 'true when phone number was not previously registered' })
  isNewUser: boolean;
}

export class VerifyOtpResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty({ description: 'true when a brand-new account was created for this number' })
  isNewUser: boolean;

  @ApiProperty()
  user: {
    id: string;
    phone: string;
    role: string;
    isPhoneVerified: boolean;
    profile: {
      displayName: string | null;
      avatarUrl: string | null;
      city: string | null;
      isProvider: boolean;
    } | null;
  };
}

export class RefreshResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;
}
