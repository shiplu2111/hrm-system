import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Database,
  Eye,
  EyeOff,
  HardDrive,
  Info,
  Key,
  Layers,
  Lock,
  Mail,
  MessageSquare,
  RefreshCw,
  Save,
  Send,
  Server,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type {
  PlatformAllSettingsView,
  PlatformBillingSettings,
  PlatformEmailProviderKind,
  PlatformEmailSettings,
  PlatformPushSettings,
  PlatformSmsProviderKind,
  PlatformSmsSettings,
  PlatformStorageDriverKind,
  PlatformStorageSettings,
  TestBillingResult,
  TestEmailResult,
  TestPushResult,
  TestSmsResult,
  TestStorageResult,
} from '@hrm/shared-types';
import {
  getPlatformAllSettings,
  sendPlatformTestEmail,
  sendPlatformTestSms,
  testPlatformBillingConnection,
  testPlatformPushConnection,
  testPlatformStorageConnection,
  updatePlatformBillingSettings,
  updatePlatformEmailSettings,
  updatePlatformPushSettings,
  updatePlatformSmsSettings,
  updatePlatformStorageSettings,
} from '@/lib/platform-settings-api';

type TabKey = 'email' | 'sms' | 'push' | 'storage' | 'billing';

export function PlatformSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('email');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Loaded Settings
  const [emailSettings, setEmailSettings] = useState<PlatformEmailSettings | null>(null);
  const [smsSettings, setSmsSettings] = useState<PlatformSmsSettings | null>(null);
  const [pushSettings, setPushSettings] = useState<PlatformPushSettings | null>(null);
  const [storageSettings, setStorageSettings] = useState<PlatformStorageSettings | null>(null);
  const [billingSettings, setBillingSettings] = useState<PlatformBillingSettings | null>(null);

  // Forms State
  // 1. Email Form
  const [emailForm, setEmailForm] = useState({
    provider: 'smtp' as PlatformEmailProviderKind,
    host: '',
    port: 587,
    secure: false,
    username: '',
    password: '',
    fromAddress: '',
    fromName: '',
  });
  const [isReplacingEmailPassword, setIsReplacingEmailPassword] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [testEmailSubject, setTestEmailSubject] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<TestEmailResult | null>(null);

  // 2. SMS Form
  const [smsForm, setSmsForm] = useState({
    provider: 'twilio' as PlatformSmsProviderKind,
    accountSid: '',
    authToken: '',
    fromNumber: '',
  });
  const [isReplacingSmsToken, setIsReplacingSmsToken] = useState(false);
  const [testSmsRecipient, setTestSmsRecipient] = useState('');
  const [testingSms, setTestingSms] = useState(false);
  const [testSmsResult, setTestSmsResult] = useState<TestSmsResult | null>(null);

  // 3. Push Form
  const [pushForm, setPushForm] = useState({
    provider: 'firebase' as const,
    projectId: '',
    clientEmail: '',
    privateKey: '',
    appId: '',
  });
  const [isReplacingPushKey, setIsReplacingPushKey] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [testPushResult, setTestPushResult] = useState<TestPushResult | null>(null);

  // 4. Storage Form
  const [storageForm, setStorageForm] = useState({
    storageDriver: 'local' as PlatformStorageDriverKind,
    localPath: './storage',
    s3Bucket: '',
    s3Region: 'us-east-1',
    s3Endpoint: '',
    s3ForcePathStyle: false,
    s3AccessKeyId: '',
    s3SecretKey: '',
  });
  const [isReplacingStorageKey, setIsReplacingStorageKey] = useState(false);
  const [testingStorage, setTestingStorage] = useState(false);
  const [testStorageResult, setTestStorageResult] = useState<TestStorageResult | null>(null);

  // 5. Billing Form
  const [billingForm, setBillingForm] = useState({
    provider: 'stripe' as const,
    publishableKey: '',
    secretKey: '',
    webhookSecret: '',
    currency: 'USD',
  });
  const [isReplacingBillingSecret, setIsReplacingBillingSecret] = useState(false);
  const [isReplacingWebhookSecret, setIsReplacingWebhookSecret] = useState(false);
  const [testingBilling, setTestingBilling] = useState(false);
  const [testBillingResult, setTestBillingResult] = useState<TestBillingResult | null>(null);

  useEffect(() => {
    loadAllSettings();
  }, []);

  const loadAllSettings = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res: PlatformAllSettingsView = await getPlatformAllSettings();
      setEmailSettings(res.email);
      setSmsSettings(res.sms);
      setPushSettings(res.push);
      setStorageSettings(res.storage);
      setBillingSettings(res.billing);

      // Populate forms
      setEmailForm({
        provider: res.email.provider,
        host: res.email.host,
        port: res.email.port,
        secure: res.email.secure,
        username: res.email.username,
        password: '',
        fromAddress: res.email.fromAddress,
        fromName: res.email.fromName,
      });
      setIsReplacingEmailPassword(!res.email.passwordConfigured);

      setSmsForm({
        provider: res.sms.provider,
        accountSid: res.sms.accountSid,
        authToken: '',
        fromNumber: res.sms.fromNumber,
      });
      setIsReplacingSmsToken(!res.sms.authTokenConfigured);

      setPushForm({
        provider: 'firebase',
        projectId: res.push.projectId,
        clientEmail: res.push.clientEmail,
        privateKey: '',
        appId: res.push.appId || '',
      });
      setIsReplacingPushKey(!res.push.privateKeyConfigured);

      setStorageForm({
        storageDriver: res.storage.storageDriver,
        localPath: res.storage.localPath || './storage',
        s3Bucket: res.storage.s3Bucket || '',
        s3Region: res.storage.s3Region || 'us-east-1',
        s3Endpoint: res.storage.s3Endpoint || '',
        s3ForcePathStyle: Boolean(res.storage.s3ForcePathStyle),
        s3AccessKeyId: res.storage.s3AccessKeyId || '',
        s3SecretKey: '',
      });
      setIsReplacingStorageKey(!res.storage.s3SecretKeyConfigured);

      setBillingForm({
        provider: 'stripe',
        publishableKey: res.billing.publishableKey,
        secretKey: '',
        webhookSecret: '',
        currency: res.billing.currency,
      });
      setIsReplacingBillingSecret(!res.billing.secretKeyConfigured);
      setIsReplacingWebhookSecret(!res.billing.webhookSecretConfigured);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch platform operational settings.');
    } finally {
      setLoading(false);
    }
  };

  const showSuccessBanner = (msg: string) => {
    setSaveSuccessMsg(msg);
    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 4000);
  };

  // ==========================================================================
  // Handlers: Save
  // ==========================================================================

  const handleSaveEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg(null);
      const updated = await updatePlatformEmailSettings({
        provider: emailForm.provider,
        host: emailForm.host,
        port: Number(emailForm.port),
        secure: emailForm.secure,
        username: emailForm.username,
        password: isReplacingEmailPassword && emailForm.password ? emailForm.password : undefined,
        fromAddress: emailForm.fromAddress,
        fromName: emailForm.fromName,
      });
      setEmailSettings(updated);
      setEmailForm((prev) => ({ ...prev, password: '' }));
      setIsReplacingEmailPassword(false);
      showSuccessBanner('Default SMTP / email settings successfully updated and audit logged.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save email settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSms = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg(null);
      const updated = await updatePlatformSmsSettings({
        provider: smsForm.provider,
        accountSid: smsForm.accountSid,
        authToken: isReplacingSmsToken && smsForm.authToken ? smsForm.authToken : undefined,
        fromNumber: smsForm.fromNumber,
      });
      setSmsSettings(updated);
      setSmsForm((prev) => ({ ...prev, authToken: '' }));
      setIsReplacingSmsToken(false);
      showSuccessBanner('Default SMS provider settings successfully saved and encrypted.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save SMS settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePush = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg(null);
      const updated = await updatePlatformPushSettings({
        provider: 'firebase',
        projectId: pushForm.projectId,
        clientEmail: pushForm.clientEmail,
        privateKey: isReplacingPushKey && pushForm.privateKey ? pushForm.privateKey : undefined,
        appId: pushForm.appId || undefined,
      });
      setPushSettings(updated);
      setPushForm((prev) => ({ ...prev, privateKey: '' }));
      setIsReplacingPushKey(false);
      showSuccessBanner('Firebase push credentials successfully updated and audit logged.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save Firebase push settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStorage = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg(null);
      const updated = await updatePlatformStorageSettings({
        storageDriver: storageForm.storageDriver,
        localPath: storageForm.localPath,
        s3Bucket: storageForm.s3Bucket || undefined,
        s3Region: storageForm.s3Region || undefined,
        s3Endpoint: storageForm.s3Endpoint || undefined,
        s3ForcePathStyle: storageForm.s3ForcePathStyle,
        s3AccessKeyId: storageForm.s3AccessKeyId || undefined,
        s3SecretKey:
          isReplacingStorageKey && storageForm.s3SecretKey ? storageForm.s3SecretKey : undefined,
      });
      setStorageSettings(updated);
      setStorageForm((prev) => ({ ...prev, s3SecretKey: '' }));
      setIsReplacingStorageKey(false);
      showSuccessBanner(`Storage driver "${updated.storageDriver}" configuration saved.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save storage settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBilling = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setErrorMsg(null);
      const updated = await updatePlatformBillingSettings({
        provider: 'stripe',
        publishableKey: billingForm.publishableKey,
        secretKey:
          isReplacingBillingSecret && billingForm.secretKey ? billingForm.secretKey : undefined,
        webhookSecret:
          isReplacingWebhookSecret && billingForm.webhookSecret
            ? billingForm.webhookSecret
            : undefined,
        currency: billingForm.currency,
      });
      setBillingSettings(updated);
      setBillingForm((prev) => ({ ...prev, secretKey: '', webhookSecret: '' }));
      setIsReplacingBillingSecret(false);
      setIsReplacingWebhookSecret(false);
      showSuccessBanner('Stripe keys and webhook secret encrypted and updated.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save Stripe billing settings.');
    } finally {
      setSaving(false);
    }
  };

  // ==========================================================================
  // Handlers: Tests
  // ==========================================================================

  const handleTestEmail = async () => {
    if (!testEmailRecipient || !testEmailRecipient.includes('@')) {
      setErrorMsg('Please specify a valid recipient email for the test dispatch.');
      return;
    }
    try {
      setTestingEmail(true);
      setErrorMsg(null);
      const res = await sendPlatformTestEmail({
        to: testEmailRecipient,
        subject: testEmailSubject || undefined,
      });
      setTestEmailResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Test email delivery failed.');
    } finally {
      setTestingEmail(false);
    }
  };

  const handleTestSms = async () => {
    if (!testSmsRecipient || testSmsRecipient.length < 5) {
      setErrorMsg('Please specify a valid destination phone number (e.g. +15551234567).');
      return;
    }
    try {
      setTestingSms(true);
      setErrorMsg(null);
      const res = await sendPlatformTestSms({
        to: testSmsRecipient,
        message: 'CMSN HRM Platform test SMS ping',
      });
      setTestSmsResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Test SMS dispatch failed.');
    } finally {
      setTestingSms(false);
    }
  };

  const handleTestPush = async () => {
    try {
      setTestingPush(true);
      setErrorMsg(null);
      const res = await testPlatformPushConnection();
      setTestPushResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Firebase Push verification failed.');
    } finally {
      setTestingPush(false);
    }
  };

  const handleTestStorage = async () => {
    try {
      setTestingStorage(true);
      setErrorMsg(null);
      const res = await testPlatformStorageConnection();
      setTestStorageResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Storage connection test failed.');
    } finally {
      setTestingStorage(false);
    }
  };

  const handleTestBilling = async () => {
    try {
      setTestingBilling(true);
      setErrorMsg(null);
      const res = await testPlatformBillingConnection();
      setTestBillingResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Stripe API connection test failed.');
    } finally {
      setTestingBilling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-500">
        <RefreshCw className="h-8 w-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm font-medium">Loading platform operational settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-900 dark:text-slate-100">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">
            <Shield className="h-4 w-4" />
            <span>SYSTEM_SETTINGS.md §2, §2a &bull; SECURITY.md §1, §11</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight">Platform Operational Settings</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Live database-backed configuration for SMTP email, SMS, push notifications, storage drivers, and Stripe billing. Never stored in .env files.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAllSettings}
            className="px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/60 rounded-xl flex items-center gap-2 shadow-sm transition-all"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reload Settings</span>
          </button>
        </div>
      </div>

      {/* Security Architecture Callout */}
      <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/60 flex items-start gap-3.5">
        <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0 mt-0.5 shadow-sm">
          <Lock className="h-4 w-4" />
        </div>
        <div className="text-xs space-y-1">
          <div className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-2">
            <span>Secrets Encryption at Rest &amp; Replace Semantics</span>
            <span className="px-2 py-0.5 text-[10px] font-extrabold uppercase rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
              AES-256-GCM
            </span>
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            All passwords, tokens, private keys, and webhook signing secrets are encrypted at rest using AES-256-GCM. Read endpoints return masked placeholders (<code className="font-mono bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">••••••••</code>) and never echo raw secrets back to the client. Existing secrets are preserved unless explicitly modified through "Replace". Every change triggers an immutable audit log entry.
          </p>
        </div>
      </div>

      {/* Error & Success Messages */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center gap-3 text-sm text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {saveSuccessMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3 text-sm text-emerald-700 dark:text-emerald-300 animate-fade-in">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-px overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveTab('email')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'email'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 shadow-sm'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Mail className="h-4 w-4" />
          <span>Email (SMTP)</span>
          {emailSettings?.configured && (
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sms')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'sms'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 shadow-sm'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          <span>SMS Provider</span>
          {smsSettings?.configured && (
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('push')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'push'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 shadow-sm'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Bell className="h-4 w-4" />
          <span>Push (Firebase)</span>
          {pushSettings?.configured && (
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('storage')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'storage'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 shadow-sm'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <HardDrive className="h-4 w-4" />
          <span>Storage (S3 / Local)</span>
          {storageSettings?.configured && (
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('billing')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 whitespace-nowrap ${
            activeTab === 'billing'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-900 shadow-sm'
              : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>Billing (Stripe)</span>
          {billingSettings?.configured && (
            <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
          )}
        </button>
      </div>

      {/* =====================================================================
          TAB 1: EMAIL (SMTP)
         ===================================================================== */}
      {activeTab === 'email' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <form
              onSubmit={handleSaveEmail}
              className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <Mail className="h-4 w-4 text-indigo-600" />
                    <span>Default SMTP &amp; Outbound Email Configuration</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Fallback email provider used for tenant onboarding, password resets, and system announcements.
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border ${
                    emailSettings?.configured
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 border-amber-200 dark:border-amber-800'
                  }`}
                >
                  {emailSettings?.configured ? 'Active in DB' : 'Using Baseline Defaults'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Provider
                  </label>
                  <select
                    value={emailForm.provider}
                    onChange={(e) =>
                      setEmailForm({
                        ...emailForm,
                        provider: e.target.value as PlatformEmailProviderKind,
                      })
                    }
                    className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="smtp">Standard SMTP Server</option>
                    <option value="sendgrid">SendGrid SMTP Relay</option>
                    <option value="postmark">Postmark</option>
                    <option value="ses">Amazon SES</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    required
                    value={emailForm.host}
                    onChange={(e) => setEmailForm({ ...emailForm, host: e.target.value })}
                    placeholder="e.g. smtp.sendgrid.net"
                    className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    SMTP Port
                  </label>
                  <input
                    type="number"
                    required
                    value={emailForm.port}
                    onChange={(e) => setEmailForm({ ...emailForm, port: Number(e.target.value) })}
                    placeholder="587"
                    className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <input
                    type="checkbox"
                    id="email-secure"
                    checked={emailForm.secure}
                    onChange={(e) => setEmailForm({ ...emailForm, secure: e.target.checked })}
                    className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                  />
                  <label
                    htmlFor="email-secure"
                    className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Use SSL / TLS connection (port 465)
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    SMTP Username / API Key
                  </label>
                  <input
                    type="text"
                    required
                    value={emailForm.username}
                    onChange={(e) => setEmailForm({ ...emailForm, username: e.target.value })}
                    placeholder="e.g. apikey or user@domain.com"
                    className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      SMTP Password / Secret
                    </label>
                    {emailSettings?.passwordConfigured && !isReplacingEmailPassword && (
                      <button
                        type="button"
                        onClick={() => setIsReplacingEmailPassword(true)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-500 underline"
                      >
                        Replace Secret
                      </button>
                    )}
                  </div>

                  {!isReplacingEmailPassword && emailSettings?.passwordConfigured ? (
                    <div className="flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs">
                      <Lock className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="font-mono text-slate-500 tracking-wider">••••••••</span>
                      <span className="text-[10px] ml-auto font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        Saved &amp; Encrypted
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="relative">
                        <input
                          type="password"
                          value={emailForm.password}
                          onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                          placeholder={
                            emailSettings?.passwordConfigured
                              ? 'Enter new secret to replace...'
                              : 'Enter SMTP secret password...'
                          }
                          className="w-full h-10 px-3 pr-20 text-xs rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        {emailSettings?.passwordConfigured && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsReplacingEmailPassword(false);
                              setEmailForm({ ...emailForm, password: '' });
                            }}
                            className="absolute right-2 top-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 px-2 py-1"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        Encrypted with AES-256-GCM before saving into platform_settings table.
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Default From Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={emailForm.fromAddress}
                    onChange={(e) => setEmailForm({ ...emailForm, fromAddress: e.target.value })}
                    placeholder="noreply@hrm-platform.io"
                    className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Default From Name
                  </label>
                  <input
                    type="text"
                    required
                    value={emailForm.fromName}
                    onChange={(e) => setEmailForm({ ...emailForm, fromName: e.target.value })}
                    placeholder="CMSN HRM Platform"
                    className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-900/15 transition-all"
                >
                  {saving ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>Save Email Configuration</span>
                </button>
              </div>
            </form>
          </div>

          {/* Test Email Action Card */}
          <div className="space-y-4">
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                <Send className="h-4 w-4 text-indigo-600" />
                <span>Send Test Email</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Dispatch an immediate test message through the configured platform SMTP credentials to verify connectivity and deliverability.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Recipient Address
                  </label>
                  <input
                    type="email"
                    value={testEmailRecipient}
                    onChange={(e) => setTestEmailRecipient(e.target.value)}
                    placeholder="operator@company.com"
                    className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Custom Subject (Optional)
                  </label>
                  <input
                    type="text"
                    value={testEmailSubject}
                    onChange={(e) => setTestEmailSubject(e.target.value)}
                    placeholder="Platform SMTP Diagnostic"
                    className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={testingEmail || !testEmailRecipient}
                  className="w-full h-9 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm"
                >
                  {testingEmail ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>Send Test Email</span>
                </button>
              </div>

              {testEmailResult && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1.5 animate-fade-in text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Email Successfully Dispatched</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    {testEmailResult.message}
                  </p>
                  <div className="pt-1 text-[10px] font-mono text-emerald-800/80 dark:text-emerald-400/80 break-all">
                    Message-ID: {testEmailResult.messageId}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 text-xs space-y-2">
              <span className="font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                <Info className="h-3.5 w-3.5 text-indigo-500" />
                <span>Tenant Fallback Rules</span>
              </span>
              <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                When an individual tenant configures their custom SMTP domain in Company Settings, their domain takes precedence. Platform SMTP is used strictly as a guaranteed fallback.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: SMS PROVIDER
         ===================================================================== */}
      {activeTab === 'sms' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <form
              onSubmit={handleSaveSms}
              className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-indigo-600" />
                    <span>SMS Gateway &amp; Provider Credentials</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Platform-wide SMS service for urgent OTP codes, shift cover alerts, and offline sync verification.
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border ${
                    smsSettings?.configured
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 border-amber-200 dark:border-amber-800'
                  }`}
                >
                  {smsSettings?.configured ? 'Active in DB' : 'Default Seed'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    SMS Provider
                  </label>
                  <select
                    value={smsForm.provider}
                    onChange={(e) =>
                      setSmsForm({ ...smsForm, provider: e.target.value as PlatformSmsProviderKind })
                    }
                    className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="twilio">Twilio Programmable SMS</option>
                    <option value="messagebird">MessageBird</option>
                    <option value="sns">Amazon SNS</option>
                    <option value="custom">Custom Webhook Gateway</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Account SID / Client Key
                  </label>
                  <input
                    type="text"
                    required
                    value={smsForm.accountSid}
                    onChange={(e) => setSmsForm({ ...smsForm, accountSid: e.target.value })}
                    placeholder="e.g. ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Auth Token / Secret Key
                    </label>
                    {smsSettings?.authTokenConfigured && !isReplacingSmsToken && (
                      <button
                        type="button"
                        onClick={() => setIsReplacingSmsToken(true)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-500 underline"
                      >
                        Replace Auth Token
                      </button>
                    )}
                  </div>

                  {!isReplacingSmsToken && smsSettings?.authTokenConfigured ? (
                    <div className="flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs">
                      <Lock className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="font-mono text-slate-500 tracking-wider">••••••••</span>
                      <span className="text-[10px] ml-auto font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        Saved &amp; Encrypted
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="relative">
                        <input
                          type="password"
                          value={smsForm.authToken}
                          onChange={(e) => setSmsForm({ ...smsForm, authToken: e.target.value })}
                          placeholder={
                            smsSettings?.authTokenConfigured
                              ? 'Enter new auth token to replace...'
                              : 'Enter provider auth token...'
                          }
                          className="w-full h-10 px-3 pr-20 text-xs rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        {smsSettings?.authTokenConfigured && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsReplacingSmsToken(false);
                              setSmsForm({ ...smsForm, authToken: '' });
                            }}
                            className="absolute right-2 top-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 px-2 py-1"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        Never returned by read API.
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    From Phone Number (E.164)
                  </label>
                  <input
                    type="text"
                    required
                    value={smsForm.fromNumber}
                    onChange={(e) => setSmsForm({ ...smsForm, fromNumber: e.target.value })}
                    placeholder="e.g. +15550192837"
                    className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-900/15 transition-all"
                >
                  {saving ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>Save SMS Configuration</span>
                </button>
              </div>
            </form>
          </div>

          {/* Test SMS Action Card */}
          <div className="space-y-4">
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                <Send className="h-4 w-4 text-indigo-600" />
                <span>Send Test SMS</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Send a real-time probe SMS to verify provider credentials, balance, and sender route verification.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                    Destination Mobile Number
                  </label>
                  <input
                    type="text"
                    value={testSmsRecipient}
                    onChange={(e) => setTestSmsRecipient(e.target.value)}
                    placeholder="+15559876543"
                    className="w-full h-9 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleTestSms}
                  disabled={testingSms || !testSmsRecipient}
                  className="w-full h-9 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm"
                >
                  {testingSms ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>Send Test SMS</span>
                </button>
              </div>

              {testSmsResult && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1.5 animate-fade-in text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>SMS Dispatch Confirmed</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    {testSmsResult.message}
                  </p>
                  <div className="pt-1 text-[10px] font-mono text-emerald-800/80 dark:text-emerald-400/80">
                    Provider SID: {testSmsResult.sid}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: PUSH (FIREBASE)
         ===================================================================== */}
      {activeTab === 'push' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <form
              onSubmit={handleSavePush}
              className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <Bell className="h-4 w-4 text-indigo-600" />
                    <span>Firebase Cloud Messaging (FCM) Project Settings</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Service account credentials powering web notifications, mobile push alerts, and shift updates.
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border ${
                    pushSettings?.configured
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 border-amber-200 dark:border-amber-800'
                  }`}
                >
                  {pushSettings?.configured ? 'Active in DB' : 'Default Seed'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Firebase Project ID
                  </label>
                  <input
                    type="text"
                    required
                    value={pushForm.projectId}
                    onChange={(e) => setPushForm({ ...pushForm, projectId: e.target.value })}
                    placeholder="e.g. hrm-cloud-prod"
                    className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Client App ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={pushForm.appId}
                    onChange={(e) => setPushForm({ ...pushForm, appId: e.target.value })}
                    placeholder="1:1234567890:web:abcdef"
                    className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Service Account Client Email
                  </label>
                  <input
                    type="email"
                    required
                    value={pushForm.clientEmail}
                    onChange={(e) => setPushForm({ ...pushForm, clientEmail: e.target.value })}
                    placeholder="firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com"
                    className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Service Account Private Key (RSA)
                    </label>
                    {pushSettings?.privateKeyConfigured && !isReplacingPushKey && (
                      <button
                        type="button"
                        onClick={() => setIsReplacingPushKey(true)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-500 underline"
                      >
                        Replace Private Key
                      </button>
                    )}
                  </div>

                  {!isReplacingPushKey && pushSettings?.privateKeyConfigured ? (
                    <div className="flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs">
                      <Lock className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="font-mono text-slate-500 tracking-wider">••••••••••••••••••••••••</span>
                      <span className="text-[10px] ml-auto font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        Saved &amp; Encrypted
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="relative">
                        <textarea
                          rows={4}
                          value={pushForm.privateKey}
                          onChange={(e) => setPushForm({ ...pushForm, privateKey: e.target.value })}
                          placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC...&#10;-----END PRIVATE KEY-----"
                          className="w-full p-3 font-mono text-xs rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-950 focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        {pushSettings?.privateKeyConfigured && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsReplacingPushKey(false);
                              setPushForm({ ...pushForm, privateKey: '' });
                            }}
                            className="absolute right-3 top-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 px-2 py-1 bg-white dark:bg-slate-900 rounded"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        Stored encrypted with AES-256-GCM.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-900/15 transition-all"
                >
                  {saving ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>Save Firebase Configuration</span>
                </button>
              </div>
            </form>
          </div>

          {/* Test Push Action Card */}
          <div className="space-y-4">
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                <ShieldCheck className="h-4 w-4 text-indigo-600" />
                <span>Test Firebase Connection</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Validates service account credentials, project authentication token handshake, and FCM routing.
              </p>

              <button
                type="button"
                onClick={handleTestPush}
                disabled={testingPush || !pushForm.projectId}
                className="w-full h-9 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm"
              >
                {testingPush ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span>Verify Firebase Connection</span>
              </button>

              {testPushResult && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1.5 animate-fade-in text-xs">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Firebase Handshake Verified</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    {testPushResult.message}
                  </p>
                  <div className="pt-1 text-[10px] font-mono text-emerald-800/80 dark:text-emerald-400/80">
                    Project: {testPushResult.projectId}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 4: STORAGE (S3 / LOCAL)
         ===================================================================== */}
      {activeTab === 'storage' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <form
              onSubmit={handleSaveStorage}
              className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-indigo-600" />
                    <span>Platform Default Storage Driver &amp; Object Store</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Storage driver for documents, employee contracts, avatar media, and payroll exports.
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border ${
                    storageSettings?.configured
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 border-amber-200 dark:border-amber-800'
                  }`}
                >
                  {storageSettings?.configured ? 'Active in DB' : 'Default Local'}
                </span>
              </div>

              {/* Driver selection radio cards */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Active Storage Driver
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div
                    onClick={() => setStorageForm({ ...storageForm, storageDriver: 'local' })}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                      storageForm.storageDriver === 'local'
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50'
                    }`}
                  >
                    <Server className="h-5 w-5 text-indigo-600 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold">Local Filesystem</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Stores uploaded assets directly on local disk mount.
                      </div>
                    </div>
                  </div>

                  <div
                    onClick={() => setStorageForm({ ...storageForm, storageDriver: 's3' })}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3 ${
                      storageForm.storageDriver === 's3'
                        ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30'
                        : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50'
                    }`}
                  >
                    <Database className="h-5 w-5 text-indigo-600 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold">Amazon S3 / MinIO / Cloudflare R2</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Cloud object storage bucket with multi-region replication.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Local Storage Fields */}
              {storageForm.storageDriver === 'local' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Local Filesystem Base Directory Path
                  </label>
                  <input
                    type="text"
                    required
                    value={storageForm.localPath}
                    onChange={(e) => setStorageForm({ ...storageForm, localPath: e.target.value })}
                    placeholder="./storage"
                    className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <span className="text-[11px] text-slate-400 mt-1 block">
                    Relative or absolute directory on server where uploaded tenant files reside.
                  </span>
                </div>
              )}

              {/* S3 Storage Fields */}
              {storageForm.storageDriver === 's3' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      S3 Bucket Name
                    </label>
                    <input
                      type="text"
                      required
                      value={storageForm.s3Bucket}
                      onChange={(e) => setStorageForm({ ...storageForm, s3Bucket: e.target.value })}
                      placeholder="e.g. hrm-documents-vault"
                      className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      S3 Region Code
                    </label>
                    <input
                      type="text"
                      value={storageForm.s3Region}
                      onChange={(e) => setStorageForm({ ...storageForm, s3Region: e.target.value })}
                      placeholder="us-east-1"
                      className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Custom S3 Endpoint (Optional)
                    </label>
                    <input
                      type="text"
                      value={storageForm.s3Endpoint}
                      onChange={(e) =>
                        setStorageForm({ ...storageForm, s3Endpoint: e.target.value })
                      }
                      placeholder="https://s3.your-domain.com or blank for AWS"
                      className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-6">
                    <input
                      type="checkbox"
                      id="s3-path-style"
                      checked={storageForm.s3ForcePathStyle}
                      onChange={(e) =>
                        setStorageForm({ ...storageForm, s3ForcePathStyle: e.target.checked })
                      }
                      className="h-4 w-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 dark:border-slate-700"
                    />
                    <label
                      htmlFor="s3-path-style"
                      className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                    >
                      Force Path Style (Required for MinIO / LocalStack)
                    </label>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      S3 Access Key ID
                    </label>
                    <input
                      type="text"
                      value={storageForm.s3AccessKeyId}
                      onChange={(e) =>
                        setStorageForm({ ...storageForm, s3AccessKeyId: e.target.value })
                      }
                      placeholder="AKIAIOSFODNN7EXAMPLE"
                      className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        S3 Secret Access Key
                      </label>
                      {storageSettings?.s3SecretKeyConfigured && !isReplacingStorageKey && (
                        <button
                          type="button"
                          onClick={() => setIsReplacingStorageKey(true)}
                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-500 underline"
                        >
                          Replace Secret Key
                        </button>
                      )}
                    </div>

                    {!isReplacingStorageKey && storageSettings?.s3SecretKeyConfigured ? (
                      <div className="flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs">
                        <Lock className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="font-mono text-slate-500 tracking-wider">••••••••</span>
                        <span className="text-[10px] ml-auto font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                          Saved &amp; Encrypted
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="relative">
                          <input
                            type="password"
                            value={storageForm.s3SecretKey}
                            onChange={(e) =>
                              setStorageForm({ ...storageForm, s3SecretKey: e.target.value })
                            }
                            placeholder={
                              storageSettings?.s3SecretKeyConfigured
                                ? 'Enter new secret key to replace...'
                                : 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'
                            }
                            className="w-full h-10 px-3 pr-20 text-xs rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                          />
                          {storageSettings?.s3SecretKeyConfigured && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsReplacingStorageKey(false);
                                setStorageForm({ ...storageForm, s3SecretKey: '' });
                              }}
                              className="absolute right-2 top-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 px-2 py-1"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block">
                          Never returned by API.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-900/15 transition-all"
                >
                  {saving ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>Save Storage Configuration</span>
                </button>
              </div>
            </form>
          </div>

          {/* Test Storage Action Card */}
          <div className="space-y-4">
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                <HardDrive className="h-4 w-4 text-indigo-600" />
                <span>Test Storage Driver Probe</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Executes an atomic read/write storage probe test to verify folder permissions or bucket access policies and calculate latency.
              </p>

              <button
                type="button"
                onClick={handleTestStorage}
                disabled={testingStorage}
                className="w-full h-9 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm"
              >
                {testingStorage ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span>Run Storage Probe Test</span>
              </button>

              {testStorageResult && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1.5 animate-fade-in text-xs">
                  <div className="flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Probe Verified</span>
                    </span>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded font-mono">
                      {testStorageResult.latencyMs}ms latency
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    {testStorageResult.message}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 5: BILLING (STRIPE)
         ===================================================================== */}
      {activeTab === 'billing' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <form
              onSubmit={handleSaveBilling}
              className="p-6 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-indigo-600" />
                    <span>Stripe Billing &amp; Webhook Credentials</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Platform billing provider for SaaS tenant plan subscriptions, automatic invoicing, and card payments.
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg border ${
                    billingSettings?.configured
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 border-emerald-200 dark:border-emerald-800'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 border-amber-200 dark:border-amber-800'
                  }`}
                >
                  {billingSettings?.configured ? 'Active in DB' : 'Default Seed'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Stripe Publishable Key
                  </label>
                  <input
                    type="text"
                    required
                    value={billingForm.publishableKey}
                    onChange={(e) =>
                      setBillingForm({ ...billingForm, publishableKey: e.target.value })
                    }
                    placeholder="pk_test_51Mz000000000000000000000"
                    className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Safe for public web client subscription checkouts.
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Default Billing Currency
                  </label>
                  <select
                    value={billingForm.currency}
                    onChange={(e) => setBillingForm({ ...billingForm, currency: e.target.value })}
                    className="w-full h-10 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="USD">USD - US Dollar</option>
                    <option value="EUR">EUR - Euro</option>
                    <option value="GBP">GBP - British Pound</option>
                    <option value="AUD">AUD - Australian Dollar</option>
                    <option value="CAD">CAD - Canadian Dollar</option>
                    <option value="SGD">SGD - Singapore Dollar</option>
                    <option value="BDT">BDT - Bangladeshi Taka</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Stripe Secret Key (sk_test_... / sk_live_...)
                    </label>
                    {billingSettings?.secretKeyConfigured && !isReplacingBillingSecret && (
                      <button
                        type="button"
                        onClick={() => setIsReplacingBillingSecret(true)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-500 underline"
                      >
                        Replace Secret Key
                      </button>
                    )}
                  </div>

                  {!isReplacingBillingSecret && billingSettings?.secretKeyConfigured ? (
                    <div className="flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs">
                      <Lock className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="font-mono text-slate-500 tracking-wider">••••••••</span>
                      <span className="text-[10px] ml-auto font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        Saved &amp; Encrypted
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="relative">
                        <input
                          type="password"
                          value={billingForm.secretKey}
                          onChange={(e) =>
                            setBillingForm({ ...billingForm, secretKey: e.target.value })
                          }
                          placeholder={
                            billingSettings?.secretKeyConfigured
                              ? 'Enter new secret key to replace...'
                              : 'sk_test_51Mz0000000000000'
                          }
                          className="w-full h-10 px-3 pr-20 text-xs rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        {billingSettings?.secretKeyConfigured && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsReplacingBillingSecret(false);
                              setBillingForm({ ...billingForm, secretKey: '' });
                            }}
                            className="absolute right-2 top-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 px-2 py-1"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        Never returned plaintext by API.
                      </span>
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      Stripe Webhook Signing Secret (whsec_...)
                    </label>
                    {billingSettings?.webhookSecretConfigured && !isReplacingWebhookSecret && (
                      <button
                        type="button"
                        onClick={() => setIsReplacingWebhookSecret(true)}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-500 underline"
                      >
                        Replace Webhook Secret
                      </button>
                    )}
                  </div>

                  {!isReplacingWebhookSecret && billingSettings?.webhookSecretConfigured ? (
                    <div className="flex items-center gap-2 h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 text-xs">
                      <Lock className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="font-mono text-slate-500 tracking-wider">••••••••</span>
                      <span className="text-[10px] ml-auto font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                        Saved &amp; Encrypted
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="relative">
                        <input
                          type="password"
                          value={billingForm.webhookSecret}
                          onChange={(e) =>
                            setBillingForm({ ...billingForm, webhookSecret: e.target.value })
                          }
                          placeholder={
                            billingSettings?.webhookSecretConfigured
                              ? 'Enter new webhook secret to replace...'
                              : 'whsec_xxxxxxxxxxxxxxxxxxxx'
                          }
                          className="w-full h-10 px-3 pr-20 text-xs rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-950 font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        {billingSettings?.webhookSecretConfigured && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsReplacingWebhookSecret(false);
                              setBillingForm({ ...billingForm, webhookSecret: '' });
                            }}
                            className="absolute right-2 top-2 text-[10px] font-bold text-slate-400 hover:text-slate-600 px-2 py-1"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        Used to verify inbound Stripe webhook event signatures.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-indigo-900/15 transition-all"
                >
                  {saving ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  <span>Save Billing Configuration</span>
                </button>
              </div>
            </form>
          </div>

          {/* Test Billing Action Card */}
          <div className="space-y-4">
            <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-slate-100">
                <CreditCard className="h-4 w-4 text-indigo-600" />
                <span>Test Stripe Connection</span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Connects to the Stripe API using decrypted secret keys to verify account authentication, test/live mode status, and currency support.
              </p>

              <button
                type="button"
                onClick={handleTestBilling}
                disabled={testingBilling}
                className="w-full h-9 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-all shadow-sm"
              >
                {testingBilling ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span>Verify Stripe Connection</span>
              </button>

              {testBillingResult && (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1.5 animate-fade-in text-xs">
                  <div className="flex items-center justify-between font-bold text-emerald-800 dark:text-emerald-300">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Stripe Handshake Verified</span>
                    </span>
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded font-mono uppercase">
                      {testBillingResult.mode} MODE
                    </span>
                  </div>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
                    {testBillingResult.message}
                  </p>
                  <div className="pt-1 text-[10px] font-mono text-emerald-800/80 dark:text-emerald-400/80">
                    Currency: {testBillingResult.currency}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
