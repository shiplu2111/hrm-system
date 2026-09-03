import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@cmsnbd.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'password', minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    example: 'demo',
    description:
      'Tenant subdomain (AUTH_FLOW.md §5). Omit for platform Super Admin login.',
  })
  @IsOptional()
  @IsString()
  tenantSubdomain?: string;

  @ApiPropertyOptional({
    description:
      'Explicit tenant UUID — only when user belongs to multiple tenants. Omit when using tenantSubdomain.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  tenantId?: string;
}

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description:
      'Refresh token from login response. Optional when sent via httpOnly cookie.',
  })
  @IsOptional()
  @IsString()
  refreshToken?: string;
}

export class PermissionClaimDto {
  @ApiProperty({ example: 'employee' })
  module!: string;

  @ApiProperty({ example: 'view' })
  action!: string;
}

export class AuthUserDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'admin@cmsnbd.com' })
  email!: string;

  @ApiProperty({ nullable: true })
  tenantId!: string | null;

  @ApiProperty()
  roleId!: string;

  @ApiProperty({ example: 'Employee' })
  roleName!: string;

  @ApiProperty({ nullable: true })
  employeeId!: string | null;

  @ApiProperty({ type: [PermissionClaimDto] })
  permissions!: PermissionClaimDto[];
}

export class LoginResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ example: 900, description: 'Access token lifetime in seconds' })
  expiresIn!: number;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}

export class RefreshResponseDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ example: 900 })
  expiresIn!: number;
}

export class ApiDataLoginResponseDto {
  @ApiProperty({ type: LoginResponseDto })
  data!: LoginResponseDto;
}

export class ApiDataRefreshResponseDto {
  @ApiProperty({ type: RefreshResponseDto })
  data!: RefreshResponseDto;
}
