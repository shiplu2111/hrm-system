import { Global, Module } from '@nestjs/common';
import { STORAGE_DRIVER } from './storage.constants';
import { createStorageDriver } from './storage.factory';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

@Global()
@Module({
  controllers: [StorageController],
  providers: [
    {
      provide: STORAGE_DRIVER,
      useFactory: () => createStorageDriver(),
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
