import { Global, Module } from '@nestjs/common';
import { DataScopeService } from './data-scope.service';
import { PermissionsService } from './permissions.service';

@Global()
@Module({
  providers: [PermissionsService, DataScopeService],
  exports: [PermissionsService, DataScopeService],
})
export class RbacModule {}
