import { IsIn, IsString, MinLength } from 'class-validator';

export class RegisterPushTokenDto {
  @IsString()
  @MinLength(1)
  token!: string;

  @IsString()
  @MinLength(1)
  deviceId!: string;

  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';
}

export class UnregisterPushTokenDto {
  @IsString()
  @MinLength(1)
  deviceId!: string;
}
