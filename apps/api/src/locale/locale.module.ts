import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { LocaleContextService } from './locale-context.service';

@Module({
  imports: [PrismaModule],
  providers: [LocaleContextService],
  exports: [LocaleContextService],
})
export class LocaleModule {}
