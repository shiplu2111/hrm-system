import { Module } from '@nestjs/common';
import { CountriesModule } from './countries/countries.module';

@Module({
  imports: [CountriesModule],
  exports: [CountriesModule],
})
export class PlatformModule {}
