import { useState } from 'react';
import {
  Laptop,
  Smartphone,
  Tablet,
  ShieldAlert,
  ShieldCheck,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Trash2,
  HardDrive,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { Avatar } from '@/components/ui/Toggle';
import { devices, type Device } from '@/data/attendanceData';

export function DevicesPage() {
  const [deviceList, setDeviceList] = useState<Device[]>(devices);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Revoked' | 'Suspicious'>('All');
  const [modalOpen, setModalOpen] = useState(false);

  // New device form
  const [empName, setEmpName] = useState('Sarah Chen');
  const [empId, setEmpId] = useState('EMP-001');
  const [devName, setDevName] = useState('');
  const [devType, setDevType] = useState('Laptop');
  const [devLocation, setDevLocation] = useState('SF HQ');

  const handleRegisterDevice = () => {
    if (!devName.trim()) return;
    const newDevice: Device = {
      id: `d${Date.now()}`,
      employeeName: empName,
      employeeId: empId,
      deviceName: devName,
      deviceType: devType,
      lastUsed: 'Just now',
      location: devLocation,
      suspicious: false,
      status: 'Active',
    };
    setDeviceList((prev) => [newDevice, ...prev]);
    setDevName('');
    setModalOpen(false);
  };

  const toggleStatus = (id: string) => {
    setDeviceList((prev) =>
      prev.map((d) =>
        d.id === id
          ? { ...d, status: d.status === 'Active' ? 'Revoked' : 'Active' }
          : d
      )
    );
  };

  const toggleSuspicious = (id: string) => {
    setDeviceList((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, suspicious: !d.suspicious } : d
      )
    );
  };

  const deleteDevice = (id: string) => {
    setDeviceList((prev) => prev.filter((d) => d.id !== id));
  };

  const filteredDevices = deviceList.filter((d) => {
    const matchesSearch =
      d.employeeName.toLowerCase().includes(search.toLowerCase()) ||
      d.employeeId.toLowerCase().includes(search.toLowerCase()) ||
      d.deviceName.toLowerCase().includes(search.toLowerCase()) ||
      d.location.toLowerCase().includes(search.toLowerCase());

    const matchesType = typeFilter === 'All' || d.deviceType === typeFilter;
    const matchesStatus =
      statusFilter === 'All'
        ? true
        : statusFilter === 'Suspicious'
        ? d.suspicious
        : d.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  const activeCount = deviceList.filter((d) => d.status === 'Active').length;
  const revokedCount = deviceList.filter((d) => d.status === 'Revoked').length;
  const suspiciousCount = deviceList.filter((d) => d.suspicious).length;

  const getDeviceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'laptop':
        return <Laptop className="h-4 w-4 text-accent-500" />;
      case 'mobile':
      case 'smartphone':
        return <Smartphone className="h-4 w-4 text-success-500" />;
      case 'tablet':
        return <Tablet className="h-4 w-4 text-purple-500" />;
      default:
        return <HardDrive className="h-4 w-4 text-secondary" />;
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Authorized Devices</h1>
          <p className="text-sm text-secondary mt-0.5">
            Monitor and manage hardware devices registered for employee attendance and clock-ins.
          </p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          <Plus className="h-4 w-4" /> Register New Device
        </Button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400 flex items-center justify-center shrink-0">
            <HardDrive className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{deviceList.length}</div>
            <div className="text-xs text-secondary">Total Registered Devices</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400 flex items-center justify-center shrink-0">
            <CheckCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{activeCount}</div>
            <div className="text-xs text-secondary">Active Devices</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center shrink-0">
            <XCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{revokedCount}</div>
            <div className="text-xs text-secondary">Revoked Devices</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-error-50 dark:bg-error-950/40 text-error-600 dark:text-error-400 flex items-center justify-center shrink-0">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{suspiciousCount}</div>
            <div className="text-xs text-secondary">Flagged / Suspicious</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardBody className="p-4">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by employee, device name, or location..."
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-36 text-xs"
              >
                <option value="All">All Types</option>
                <option value="Laptop">Laptops</option>
                <option value="Mobile">Mobiles</option>
                <option value="Tablet">Tablets</option>
              </Select>

              <div className="flex items-center gap-1">
                {(['All', 'Active', 'Revoked', 'Suspicious'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      statusFilter === st
                        ? 'bg-accent-600 text-white shadow-sm'
                        : 'surface border border-base text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))]'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Devices Table */}
      <Card>
        <CardHeader className="flex items-center justify-between">
          <CardTitle>Registered Hardware</CardTitle>
          <Badge tone="neutral">{filteredDevices.length} devices found</Badge>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base bg-[rgb(var(--bg-muted))]">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Device Info
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider hidden md:table-cell">
                    Last Used
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider hidden sm:table-cell">
                    Location
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Security
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[rgb(var(--border-base))]">
                {filteredDevices.map((device) => (
                  <tr
                    key={device.id}
                    className="hover:bg-[rgb(var(--bg-hover))] transition-colors"
                  >
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={device.employeeName} size="sm" />
                        <div>
                          <div className="font-medium text-primary text-sm">{device.employeeName}</div>
                          <div className="text-xs text-muted font-mono">{device.employeeId}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-[rgb(var(--bg-muted))] flex items-center justify-center shrink-0">
                          {getDeviceIcon(device.deviceType)}
                        </div>
                        <div>
                          <div className="text-primary font-medium text-xs sm:text-sm">{device.deviceName}</div>
                          <div className="text-xs text-muted">{device.deviceType}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-5 py-3.5 text-xs text-secondary hidden md:table-cell">
                      {device.lastUsed}
                    </td>

                    <td className="px-5 py-3.5 text-xs text-secondary hidden sm:table-cell">
                      {device.location}
                    </td>

                    <td className="px-5 py-3.5">
                      {device.suspicious ? (
                        <button
                          onClick={() => toggleSuspicious(device.id)}
                          className="flex items-center gap-1.5 text-xs font-medium text-error-600 bg-error-50 dark:bg-error-950/40 px-2 py-1 rounded hover:opacity-80 transition-opacity"
                        >
                          <ShieldAlert className="h-3.5 w-3.5" />
                          Suspicious
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleSuspicious(device.id)}
                          className="flex items-center gap-1.5 text-xs text-success-600 bg-success-50 dark:bg-success-950/40 px-2 py-1 rounded hover:opacity-80 transition-opacity"
                        >
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Verified
                        </button>
                      )}
                    </td>

                    <td className="px-5 py-3.5">
                      <Badge tone={device.status === 'Active' ? 'success' : 'neutral'} dot>
                        {device.status}
                      </Badge>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant={device.status === 'Active' ? 'secondary' : 'primary'}
                          size="sm"
                          onClick={() => toggleStatus(device.id)}
                        >
                          {device.status === 'Active' ? 'Revoke' : 'Authorize'}
                        </Button>
                        <button
                          onClick={() => deleteDevice(device.id)}
                          className="p-1.5 rounded-lg text-secondary hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-950/40 transition-colors"
                          title="Delete Device"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Register Device Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Register New Device"
        description="Bind a hardware device to an employee for verified check-in."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleRegisterDevice}>
              Register Device
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Employee Name</Label>
              <Select
                value={empName}
                onChange={(e) => {
                  setEmpName(e.target.value);
                  setEmpId(e.target.value === 'Sarah Chen' ? 'EMP-001' : e.target.value === 'Marcus Johnson' ? 'EMP-002' : 'EMP-005');
                }}
              >
                <option value="Sarah Chen">Sarah Chen (EMP-001)</option>
                <option value="Marcus Johnson">Marcus Johnson (EMP-002)</option>
                <option value="Lisa Wang">Lisa Wang (EMP-005)</option>
              </Select>
            </div>
            <div>
              <Label>Primary Location</Label>
              <Select value={devLocation} onChange={(e) => setDevLocation(e.target.value)}>
                <option value="SF HQ">SF HQ</option>
                <option value="NY Office">NY Office</option>
                <option value="London Hub">London Hub</option>
                <option value="Remote">Remote</option>
              </Select>
            </div>
          </div>

          <div>
            <Label>Device Name / Model</Label>
            <Input
              value={devName}
              onChange={(e) => setDevName(e.target.value)}
              placeholder="e.g. MacBook Pro 16 (M3 Max)"
            />
          </div>

          <div>
            <Label>Device Type</Label>
            <Select value={devType} onChange={(e) => setDevType(e.target.value)}>
              <option value="Laptop">Laptop</option>
              <option value="Mobile">Mobile (iOS / Android)</option>
              <option value="Tablet">Tablet</option>
              <option value="Terminal">Biometric Terminal</option>
            </Select>
          </div>
        </div>
      </Modal>
    </div>
  );
}

