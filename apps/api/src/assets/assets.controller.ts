import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequirePermission } from '../rbac/require-permission.decorator';
import { CompanyAssetsService } from './company-assets.service';
import {
  AssignAssetDto,
  CreateCompanyAssetDto,
  ListAssetAssignmentsQueryDto,
  ListCompanyAssetsQueryDto,
  ReturnAssetDto,
} from './dto/assets.dto';

@ApiTags('assets')
@ApiBearerAuth('access-token')
@Controller()
export class AssetsController {
  constructor(private readonly assetsService: CompanyAssetsService) {}

  @Get('companies/:companyId/assets')
  @RequirePermission('employee', 'view')
  @ApiOperation({ summary: 'List company assets' })
  async listAssets(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListCompanyAssetsQueryDto,
  ) {
    return { data: await this.assetsService.list(companyId, query) };
  }

  @Post('companies/:companyId/assets')
  @RequirePermission('employee', 'edit')
  async createAsset(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Body() dto: CreateCompanyAssetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.assetsService.create(companyId, dto, user) };
  }

  @Get('assets/:assetId')
  @RequirePermission('employee', 'view')
  async getAsset(@Param('assetId', ParseUUIDPipe) assetId: string) {
    return { data: await this.assetsService.get(assetId) };
  }

  @Post('assets/:assetId/assign')
  @RequirePermission('employee', 'edit')
  async assignAsset(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Body() dto: AssignAssetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.assetsService.assign(assetId, dto, user) };
  }

  @Post('assets/:assetId/return')
  @RequirePermission('employee', 'edit')
  async returnAsset(
    @Param('assetId', ParseUUIDPipe) assetId: string,
    @Body() dto: ReturnAssetDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return { data: await this.assetsService.returnAsset(assetId, dto, user) };
  }

  @Get('companies/:companyId/asset-assignments')
  @RequirePermission('employee', 'view')
  async listAssignments(
    @Param('companyId', ParseUUIDPipe) companyId: string,
    @Query() query: ListAssetAssignmentsQueryDto,
  ) {
    return { data: await this.assetsService.listAssignments(companyId, query) };
  }
}
