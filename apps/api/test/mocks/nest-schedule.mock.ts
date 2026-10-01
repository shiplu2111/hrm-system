export const Cron = () => () => undefined;
export const Interval = () => () => undefined;
export const Timeout = () => () => undefined;

export const CronExpression = { EVERY_DAY_AT_6AM: '0 6 * * *' } as const;

export class ScheduleModule {
  static forRoot() {
    return { module: ScheduleModule };
  }
}
