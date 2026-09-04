import { Global, Module } from '@nestjs/common';
import { FieldEncryptionService } from './field-encryption.service';
import { SensitiveFieldService } from './sensitive-field.service';

@Global()
@Module({
  providers: [FieldEncryptionService, SensitiveFieldService],
  exports: [FieldEncryptionService, SensitiveFieldService],
})
export class CryptoModule {}
