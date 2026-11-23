-- AlterEnum
ALTER TYPE "platform_setting_category" ADD VALUE IF NOT EXISTS 'email';
ALTER TYPE "platform_setting_category" ADD VALUE IF NOT EXISTS 'sms';
ALTER TYPE "platform_setting_category" ADD VALUE IF NOT EXISTS 'push';
ALTER TYPE "platform_setting_category" ADD VALUE IF NOT EXISTS 'storage';
ALTER TYPE "platform_setting_category" ADD VALUE IF NOT EXISTS 'billing';
