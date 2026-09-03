import {
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import type { App } from 'firebase-admin/app';
import type { Messaging } from 'firebase-admin/messaging';

export interface PushMessageInput {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushSendResult {
  successCount: number;
  invalidTokens: string[];
}

@Injectable()
export class FirebasePushService implements OnModuleInit {
  private readonly logger = new Logger(FirebasePushService.name);
  private app: App | null = null;

  onModuleInit(): void {
    if (!this.isConfigured()) {
      this.logger.warn(
        'Firebase FCM is not configured — push delivery will be skipped until FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY are set',
      );
    }
  }

  isConfigured(): boolean {
    return Boolean(
      process.env.FIREBASE_PROJECT_ID?.trim() &&
        process.env.FIREBASE_CLIENT_EMAIL?.trim() &&
        process.env.FIREBASE_PRIVATE_KEY?.trim(),
    );
  }

  private getMessaging(): Messaging | null {
    if (!this.isConfigured()) return null;

    if (!this.app) {
      this.app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID!.trim(),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL!.trim(),
          privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, '\n'),
        }),
      });
    }

    return admin.messaging(this.app);
  }

  async sendToTokens(input: PushMessageInput): Promise<PushSendResult> {
    const messaging = this.getMessaging();
    if (!messaging) {
      throw new Error('Firebase FCM is not configured');
    }

    if (input.tokens.length === 0) {
      return { successCount: 0, invalidTokens: [] };
    }

    const response = await messaging.sendEachForMulticast({
      tokens: input.tokens,
      notification: {
        title: input.title,
        body: input.body,
      },
      data: input.data,
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } },
    });

    const invalidTokens: string[] = [];
    response.responses.forEach((result, index) => {
      if (result.success) return;
      const code = result.error?.code ?? '';
      if (
        code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token'
      ) {
        invalidTokens.push(input.tokens[index]!);
      }
    });

    return {
      successCount: response.successCount,
      invalidTokens,
    };
  }
}
