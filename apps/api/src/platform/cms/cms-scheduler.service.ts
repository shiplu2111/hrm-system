import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlatformCmsService } from './platform-cms.service';

@Injectable()
export class CmsSchedulerService {
  private readonly logger = new Logger(CmsSchedulerService.name);
  private running = false;
  private purgingTrash = false;

  constructor(private readonly cmsService: PlatformCmsService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async handleTrashRetentionPurge(): Promise<void> {
    if (this.purgingTrash) return;
    this.purgingTrash = true;
    try {
      const result = await this.cmsService.purgeExpiredTrashedPages(new Date());
      if (result.purgedCount > 0) {
        this.logger.log(
          `Purged ${result.purgedCount} expired trashed CMS page(s) past ${result.retentionDays}-day retention`,
        );
      }
    } catch (err) {
      this.logger.error(
        `CMS trash retention purge failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.purgingTrash = false;
    }
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleScheduledPublications(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const result = await this.cmsService.processDueScheduledPublications(new Date());
      const totalPublished =
        result.pagesPublished + result.postsPublished + result.changelogPublished;
      if (totalPublished > 0) {
        this.logger.log(
          `Published due scheduled CMS content (pages=${result.pagesPublished}, posts=${result.postsPublished}, changelog=${result.changelogPublished})`,
        );
      }
      if (result.skippedLegalPageIds.length > 0) {
        this.logger.warn(
          `Skipped ${result.skippedLegalPageIds.length} scheduled legal page(s) lacking Stage F approval: ${result.skippedLegalPageIds.join(', ')}`,
        );
      }
    } catch (err) {
      this.logger.error(
        `Scheduled CMS publisher failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.running = false;
    }
  }
}
