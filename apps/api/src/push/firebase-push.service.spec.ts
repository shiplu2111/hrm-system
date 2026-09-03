import { FirebasePushService } from './firebase-push.service';

const sendEachForMulticast = jest.fn();

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(() => ({})),
  credential: {
    cert: jest.fn(),
  },
  messaging: jest.fn(() => ({
    sendEachForMulticast,
  })),
}));

describe('FirebasePushService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      FIREBASE_PROJECT_ID: 'test-project',
      FIREBASE_CLIENT_EMAIL: 'firebase@test.iam.gserviceaccount.com',
      FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\ntest\\n-----END PRIVATE KEY-----',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('reports configured when all env vars are present', () => {
    const service = new FirebasePushService();
    expect(service.isConfigured()).toBe(true);
  });

  it('returns invalid tokens from FCM responses', async () => {
    sendEachForMulticast.mockResolvedValue({
      successCount: 1,
      responses: [
        { success: true },
        {
          success: false,
          error: { code: 'messaging/registration-token-not-registered' },
        },
      ],
    });

    const service = new FirebasePushService();
    const result = await service.sendToTokens({
      tokens: ['valid-token', 'stale-token'],
      title: 'Leave approved',
      body: 'Your leave was approved.',
    });

    expect(result.successCount).toBe(1);
    expect(result.invalidTokens).toEqual(['stale-token']);
  });
});
