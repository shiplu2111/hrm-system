import { useState } from 'react';
import {
  Smartphone,
  Globe,
  Fingerprint,
  QrCode,
  MessageSquare,
  ScanFace,
  ShieldCheck,
  Save,
  CheckCircle2,
  Lock,
  Sliders,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Toggle } from '@/components/ui/Toggle';
import { Input, Label, Select } from '@/components/ui/Form';

interface AttendanceMethod {
  id: string;
  name: string;
  description: string;
  icon: typeof Smartphone;
  enabled: boolean;
  requiresPhoto: boolean;
  requiresGeofence: boolean;
  allowedRoles: string;
  tone: string;
}

const initialMethods: AttendanceMethod[] = [
  {
    id: 'method-mobile',
    name: 'Mobile App GPS & Selfie',
    description: 'Employees clock in via iOS/Android app with GPS lock and optional live selfie verification.',
    icon: Smartphone,
    enabled: true,
    requiresPhoto: true,
    requiresGeofence: true,
    allowedRoles: 'All Employees',
    tone: 'bg-accent-50 text-accent-600 dark:bg-accent-950/40 dark:text-accent-400',
  },
  {
    id: 'method-web',
    name: 'Web Browser Clock-In',
    description: 'Portal-based clock in with IP whitelist restriction and network subnet validation.',
    icon: Globe,
    enabled: true,
    requiresPhoto: false,
    requiresGeofence: false,
    allowedRoles: 'Office & Remote Staff',
    tone: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400',
  },
  {
    id: 'method-biometric',
    name: 'Biometric & RFID Terminals',
    description: 'Physical hardware terminals at office turnstiles with fingerprint and RFID card readers.',
    icon: Fingerprint,
    enabled: true,
    requiresPhoto: false,
    requiresGeofence: true,
    allowedRoles: 'On-site Staff',
    tone: 'bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400',
  },
  {
    id: 'method-qr',
    name: 'Dynamic QR Code Kiosk',
    description: 'Wall-mounted tablet displaying a cryptographic 15-second rotating QR code for staff scanning.',
    icon: QrCode,
    enabled: true,
    requiresPhoto: true,
    requiresGeofence: true,
    allowedRoles: 'All Employees',
    tone: 'bg-success-50 text-success-600 dark:bg-success-950/40 dark:text-success-400',
  },
  {
    id: 'method-face',
    name: 'Facial Recognition Terminal',
    description: 'Contactless AI face terminal with 3D liveness detection and anti-spoofing.',
    icon: ScanFace,
    enabled: false,
    requiresPhoto: true,
    requiresGeofence: true,
    allowedRoles: 'Executive & HQ Staff',
    tone: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  },
  {
    id: 'method-bot',
    name: 'Slack / Teams Bot Punch',
    description: 'Quick check-in commands (/clockin) directly inside Slack or Microsoft Teams channels.',
    icon: MessageSquare,
    enabled: false,
    requiresPhoto: false,
    requiresGeofence: false,
    allowedRoles: 'Remote Only',
    tone: 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
  },
];

export function AttendanceMethodsPage() {
  const [methods, setMethods] = useState<AttendanceMethod[]>(initialMethods);
  const [requireSelfieGlobal, setRequireSelfieGlobal] = useState(true);
  const [blockMockLocation, setBlockMockLocation] = useState(true);
  const [singleDevicePolicy, setSingleDevicePolicy] = useState(true);
  const [offlineSyncAllowed, setOfflineSyncAllowed] = useState(true);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const toggleMethod = (id: string) => {
    setMethods((prev) =>
      prev.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m))
    );
  };

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const activeCount = methods.filter((m) => m.enabled).length;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Attendance Capture Methods</h1>
          <p className="text-sm text-secondary mt-0.5">
            Configure allowed clock-in channels, biometric authentication, and anti-spoofing security rules.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedSuccess && (
            <span className="text-xs font-medium text-success-600 dark:text-success-400 flex items-center gap-1.5 animate-fadeIn">
              <CheckCircle2 className="h-4 w-4" /> Policies updated
            </span>
          )}
          <Button variant="primary" onClick={handleSave}>
            <Save className="h-4 w-4" /> Save Configuration
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-primary">{activeCount} of {methods.length}</div>
            <div className="text-xs text-secondary mt-0.5">Active Clock-In Channels</div>
          </div>
          <Badge tone="success" dot>{activeCount} Active</Badge>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-primary">Strict GPS + Wi-Fi</div>
            <div className="text-xs text-secondary mt-0.5">Default Location Verification</div>
          </div>
          <Badge tone="accent">Enabled</Badge>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-primary">99.8%</div>
            <div className="text-xs text-secondary mt-0.5">Authentication Accuracy</div>
          </div>
          <Badge tone="accent">Biometrics</Badge>
        </div>
      </div>

      {/* Capture Methods Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-primary flex items-center gap-2">
            <Sliders className="h-4 w-4 text-accent-500" /> Clock-in Channels
          </h2>
          <span className="text-xs text-muted">Toggle and configure requirements for each channel</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {methods.map((method) => {
            const Icon = method.icon;
            return (
              <Card
                key={method.id}
                className={`transition-all ${
                  method.enabled
                    ? 'border-base hover:border-strong shadow-card'
                    : 'opacity-60 bg-[rgb(var(--bg-muted))]/40 border-dashed'
                }`}
              >
                <CardHeader className="flex items-start justify-between pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-xl ${method.tone} flex items-center justify-center shrink-0`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold">{method.name}</CardTitle>
                      <Badge tone={method.enabled ? 'success' : 'neutral'} className="text-[10px] mt-0.5">
                        {method.enabled ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>
                  <Toggle
                    checked={method.enabled}
                    onChange={() => toggleMethod(method.id)}
                    size="sm"
                  />
                </CardHeader>

                <CardBody className="pt-0 space-y-4">
                  <p className="text-xs text-secondary leading-relaxed">{method.description}</p>

                  <div className="pt-3 border-t border-base space-y-2 text-xs">
                    <div className="flex items-center justify-between text-secondary">
                      <span>Assigned To:</span>
                      <strong className="text-primary font-medium">{method.allowedRoles}</strong>
                    </div>
                    <div className="flex items-center justify-between text-secondary">
                      <span>Geofence Enforced:</span>
                      <Badge tone={method.requiresGeofence ? 'accent' : 'neutral'} className="text-[10px]">
                        {method.requiresGeofence ? 'Required' : 'Optional'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-secondary">
                      <span>Photo Verification:</span>
                      <Badge tone={method.requiresPhoto ? 'warning' : 'neutral'} className="text-[10px]">
                        {method.requiresPhoto ? 'Mandatory' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>
                </CardBody>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Global Security & Anti-Fraud Policy */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-accent-500" />
            <CardTitle>Anti-Fraud & Security Policies</CardTitle>
          </div>
        </CardHeader>
        <CardBody className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="surface border border-base rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-primary text-sm flex items-center gap-1.5">
                  <Lock className="h-4 w-4 text-accent-500" /> Single Device Binding
                </div>
                <div className="text-xs text-secondary mt-1">
                  Enforce that an employee can only punch from their single pre-authorized smartphone or PC.
                </div>
              </div>
              <Toggle
                checked={singleDevicePolicy}
                onChange={() => setSingleDevicePolicy(!singleDevicePolicy)}
              />
            </div>

            <div className="surface border border-base rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-primary text-sm flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-error-500" /> Block Mock Locations & Fake GPS
                </div>
                <div className="text-xs text-secondary mt-1">
                  Automatically reject punches if device developer options or mock location apps are detected.
                </div>
              </div>
              <Toggle
                checked={blockMockLocation}
                onChange={() => setBlockMockLocation(!blockMockLocation)}
              />
            </div>

            <div className="surface border border-base rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-primary text-sm flex items-center gap-1.5">
                  <ScanFace className="h-4 w-4 text-warning-500" /> Mandatory Live Selfie on Punch
                </div>
                <div className="text-xs text-secondary mt-1">
                  Capture a photo during mobile clock-in and verify with facial recognition profile.
                </div>
              </div>
              <Toggle
                checked={requireSelfieGlobal}
                onChange={() => setRequireSelfieGlobal(!requireSelfieGlobal)}
              />
            </div>

            <div className="surface border border-base rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-primary text-sm flex items-center gap-1.5">
                  <Fingerprint className="h-4 w-4 text-success-500" /> Allow Offline Punching & Queuing
                </div>
                <div className="text-xs text-secondary mt-1">
                  Allow clock-in when internet is offline with cryptographically signed local timestamp.
                </div>
              </div>
              <Toggle
                checked={offlineSyncAllowed}
                onChange={() => setOfflineSyncAllowed(!offlineSyncAllowed)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-base">
            <div>
              <Label>Biometric Match Confidence Threshold</Label>
              <Select defaultValue="92%">
                <option value="98%">Strict (98% match)</option>
                <option value="92%">Standard (92% match)</option>
                <option value="85%">Relaxed (85% match)</option>
              </Select>
            </div>
            <div>
              <Label>QR Code Expiry Duration</Label>
              <Select defaultValue="15s">
                <option value="10s">10 seconds</option>
                <option value="15s">15 seconds</option>
                <option value="30s">30 seconds</option>
                <option value="60s">60 seconds</option>
              </Select>
            </div>
            <div>
              <Label>GPS Distance Tolerance Grace</Label>
              <Input defaultValue="25 meters" />
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

