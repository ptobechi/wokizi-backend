import { IsString, Matches, Length, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VerifyPhoneOtpDto {
  @ApiProperty({ example: '+2348012345678' })
  @IsString()
  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'Phone must be in E.164 format, e.g. +2348012345678',
  })
  phone: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP sent via SMS' })
  @IsString()
  @Length(6, 6, { message: 'OTP must be exactly 6 digits' })
  code: string;

  @ApiPropertyOptional({ description: 'Device ID for token management and push notifications' })
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional({ description: 'FCM token for push notifications' })
  @IsOptional()
  @IsString()
  fcmToken?: string;

  @ApiPropertyOptional({ description: 'Device type: ios | android | web' })
  @IsOptional()
  @IsString()
  deviceType?: string;
}
