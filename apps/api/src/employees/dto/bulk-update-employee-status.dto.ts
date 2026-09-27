import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsIn, IsUUID } from 'class-validator';

const EMPLOYMENT_STATUSES = [
  'active',
  'inactive',
  'terminated',
  'on_leave',
] as const;

export class BulkUpdateEmployeeStatusDto {
  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  employeeIds!: string[];

  @ApiProperty({ enum: EMPLOYMENT_STATUSES })
  @IsIn([...EMPLOYMENT_STATUSES])
  employmentStatus!: (typeof EMPLOYMENT_STATUSES)[number];
}
