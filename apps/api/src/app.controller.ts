import { Controller, Get } from '@nestjs/common';
import type { ApiResponse } from '@hrm/shared-types';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot(): ApiResponse<{ message: string }> {
    return {
      data: { message: this.appService.getHello() },
    };
  }

  @Get('health')
  getHealth(): ApiResponse<{ status: string }> {
    return {
      data: { status: 'ok' },
    };
  }
}
