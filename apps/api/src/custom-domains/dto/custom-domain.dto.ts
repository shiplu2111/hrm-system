import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateCustomDomainDto {
  @ApiProperty({
    example: 'hr.acmepayroll.com',
    description: 'Fully qualified custom domain name for the tenant (MODULES.md §01)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(253)
  @Matches(
    /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/,
    {
      message: 'Invalid domain format. Provide a valid hostname without protocol, path, or port (e.g. hr.company.com).',
    },
  )
  domain!: string;
}

export class DisableCustomDomainDto {
  @ApiPropertyOptional({ example: 'Domain decommissioned by IT' })
  @IsOptional()
  @IsString()
  reason?: string;
}
