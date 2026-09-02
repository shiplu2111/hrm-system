import { useState } from 'react';
import {
  MapPin,
  Plus,
  Wifi,
  Shield,
  Navigation,
  Pencil,
  Trash2,
  Search,
  CheckCircle2,
  Users,
} from 'lucide-react';
import { Card, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input, Label, Select } from '@/components/ui/Form';
import { Toggle } from '@/components/ui/Toggle';

export interface GeofenceZone {
  id: string;
  name: string;
  branch: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number; // meters
  wifiSsid?: string;
  strictGps: boolean;
  allowMockLocation: boolean;
  assignedDepartments: string[];
  activeEmployees: number;
  status: 'Active' | 'Inactive';
}

const initialZones: GeofenceZone[] = [
  {
    id: 'geo-1',
    name: 'San Francisco HQ',
    branch: 'SF HQ',
    address: '100 Market St, Suite 400, San Francisco, CA 94105',
    latitude: 37.7937,
    longitude: -122.3965,
    radius: 150,
    wifiSsid: 'Acme-Corp-5G',
    strictGps: true,
    allowMockLocation: false,
    assignedDepartments: ['Engineering', 'Product', 'Executive', 'HR'],
    activeEmployees: 142,
    status: 'Active',
  },
  {
    id: 'geo-2',
    name: 'New York Office',
    branch: 'NY Office',
    address: '350 5th Ave, Floor 22, New York, NY 10118',
    latitude: 40.7484,
    longitude: -73.9857,
    radius: 200,
    wifiSsid: 'Acme-NY-Secure',
    strictGps: true,
    allowMockLocation: false,
    assignedDepartments: ['Sales', 'Marketing', 'Finance'],
    activeEmployees: 86,
    status: 'Active',
  },
  {
    id: 'geo-3',
    name: 'London Innovation Hub',
    branch: 'London Hub',
    address: '100 Bishopsgate, London EC2N 4AG, UK',
    latitude: 51.5154,
    longitude: -0.0826,
    radius: 250,
    wifiSsid: 'Acme-LDN-Guest/Staff',
    strictGps: false,
    allowMockLocation: false,
    assignedDepartments: ['Engineering', 'Design', 'Support'],
    activeEmployees: 48,
    status: 'Active',
  },
  {
    id: 'geo-4',
    name: 'East Coast Logistics Hub',
    branch: 'Warehouse East',
    address: '700 Logistics Way, Edison, NJ 08817',
    latitude: 40.5187,
    longitude: -74.4121,
    radius: 400,
    wifiSsid: 'Acme-Warehouse-IoT',
    strictGps: true,
    allowMockLocation: false,
    assignedDepartments: ['Operations', 'Logistics'],
    activeEmployees: 64,
    status: 'Inactive',
  },
];

export function GeofencePage() {
  const [zones, setZones] = useState<GeofenceZone[]>(initialZones);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<GeofenceZone | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formBranch, setFormBranch] = useState('SF HQ');
  const [formAddress, setFormAddress] = useState('');
  const [formLat, setFormLat] = useState('37.7749');
  const [formLng, setFormLng] = useState('-122.4194');
  const [formRadius, setFormRadius] = useState(150);
  const [formWifi, setFormWifi] = useState('');
  const [formStrictGps, setFormStrictGps] = useState(true);

  const openCreateModal = () => {
    setEditingZone(null);
    setFormName('');
    setFormBranch('SF HQ');
    setFormAddress('');
    setFormLat('37.7749');
    setFormLng('-122.4194');
    setFormRadius(150);
    setFormWifi('');
    setFormStrictGps(true);
    setModalOpen(true);
  };

  const openEditModal = (zone: GeofenceZone) => {
    setEditingZone(zone);
    setFormName(zone.name);
    setFormBranch(zone.branch);
    setFormAddress(zone.address);
    setFormLat(zone.latitude.toString());
    setFormLng(zone.longitude.toString());
    setFormRadius(zone.radius);
    setFormWifi(zone.wifiSsid || '');
    setFormStrictGps(zone.strictGps);
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!formName.trim()) return;

    if (editingZone) {
      setZones((prev) =>
        prev.map((z) =>
          z.id === editingZone.id
            ? {
                ...z,
                name: formName,
                branch: formBranch,
                address: formAddress,
                latitude: parseFloat(formLat) || 0,
                longitude: parseFloat(formLng) || 0,
                radius: formRadius,
                wifiSsid: formWifi || undefined,
                strictGps: formStrictGps,
              }
            : z
        )
      );
    } else {
      const newZone: GeofenceZone = {
        id: `geo-${Date.now()}`,
        name: formName,
        branch: formBranch,
        address: formAddress || 'Configured location coordinates',
        latitude: parseFloat(formLat) || 0,
        longitude: parseFloat(formLng) || 0,
        radius: formRadius,
        wifiSsid: formWifi || undefined,
        strictGps: formStrictGps,
        allowMockLocation: false,
        assignedDepartments: ['All Departments'],
        activeEmployees: 0,
        status: 'Active',
      };
      setZones((prev) => [newZone, ...prev]);
    }
    setModalOpen(false);
  };

  const toggleZoneStatus = (id: string) => {
    setZones((prev) =>
      prev.map((z) =>
        z.id === id
          ? { ...z, status: z.status === 'Active' ? 'Inactive' : 'Active' }
          : z
      )
    );
  };

  const deleteZone = (id: string) => {
    setZones((prev) => prev.filter((z) => z.id !== id));
  };

  const filteredZones = zones.filter((z) => {
    const matchesSearch =
      z.name.toLowerCase().includes(search.toLowerCase()) ||
      z.branch.toLowerCase().includes(search.toLowerCase()) ||
      z.address.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || z.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalEmployees = zones.reduce((sum, z) => sum + z.activeEmployees, 0);
  const activeCount = zones.filter((z) => z.status === 'Active').length;

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-primary">Geofencing & Location Zones</h1>
          <p className="text-sm text-secondary mt-0.5">
            Define GPS boundaries and Wi-Fi networks to validate on-site employee clock-ins.
          </p>
        </div>
        <Button variant="primary" onClick={openCreateModal}>
          <Plus className="h-4 w-4" /> Add Geofence Zone
        </Button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400 flex items-center justify-center shrink-0">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{zones.length}</div>
            <div className="text-xs text-secondary">Total Geofences</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-success-50 dark:bg-success-950/40 text-success-600 dark:text-success-400 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{activeCount}</div>
            <div className="text-xs text-secondary">Active Zones</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Wifi className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">
              {zones.filter((z) => !!z.wifiSsid).length}
            </div>
            <div className="text-xs text-secondary">Wi-Fi Bound Zones</div>
          </div>
        </div>

        <div className="surface rounded-xl border border-base shadow-card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-2xl font-bold text-primary">{totalEmployees}</div>
            <div className="text-xs text-secondary">Assigned Employees</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search zones by name, address, or branch..."
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-secondary font-medium">Status:</span>
          {(['All', 'Active', 'Inactive'] as const).map((st) => (
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

      {/* Geofence Zones List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredZones.map((zone) => (
          <Card key={zone.id} className="overflow-hidden hover:shadow-card-hover transition-shadow">
            {/* Visual map preview banner */}
            <div className="h-28 bg-[rgb(var(--bg-muted))] relative border-b border-base overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px]" />
              {/* Center zone pin with animated wave */}
              <div className="relative flex items-center justify-center">
                <div className="absolute h-20 w-20 rounded-full bg-accent-500/15 animate-ping" />
                <div className="absolute h-14 w-14 rounded-full border border-accent-500/40 bg-accent-500/10 flex items-center justify-center text-[10px] font-mono text-accent-600 font-semibold">
                  {zone.radius}m
                </div>
                <div className="relative h-8 w-8 rounded-full bg-accent-600 text-white flex items-center justify-center shadow-lg">
                  <MapPin className="h-4 w-4" />
                </div>
              </div>

              {/* Coordinates Pill */}
              <div className="absolute bottom-2 left-3 bg-[rgb(var(--bg-surface))] border border-base px-2 py-0.5 rounded text-[11px] font-mono text-muted flex items-center gap-1.5">
                <Navigation className="h-3 w-3 text-accent-500" />
                {zone.latitude.toFixed(4)}, {zone.longitude.toFixed(4)}
              </div>

              <div className="absolute top-2 right-3">
                <Badge tone={zone.status === 'Active' ? 'success' : 'neutral'} dot>
                  {zone.status}
                </Badge>
              </div>
            </div>

            <CardBody className="space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-primary text-base">{zone.name}</h3>
                    <Badge tone="accent">{zone.branch}</Badge>
                  </div>
                  <p className="text-xs text-secondary mt-1 line-clamp-1">{zone.address}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => openEditModal(zone)}
                    className="p-1.5 rounded-lg text-secondary hover:text-primary hover:bg-[rgb(var(--bg-hover))] transition-colors"
                    title="Edit Zone"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteZone(zone.id)}
                    className="p-1.5 rounded-lg text-secondary hover:text-error-600 hover:bg-error-50 dark:hover:bg-error-950/40 transition-colors"
                    title="Delete Zone"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Zone Details */}
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-base">
                <div className="flex items-center gap-1.5 text-secondary">
                  <Navigation className="h-3.5 w-3.5 text-muted" />
                  <span>Radius: <strong className="text-primary font-medium">{zone.radius} meters</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-secondary">
                  <Users className="h-3.5 w-3.5 text-muted" />
                  <span>Staff: <strong className="text-primary font-medium">{zone.activeEmployees}</strong></span>
                </div>
                <div className="flex items-center gap-1.5 text-secondary col-span-2">
                  <Wifi className="h-3.5 w-3.5 text-muted" />
                  <span>Wi-Fi SSID: <strong className="text-primary font-medium">{zone.wifiSsid || 'None (GPS only)'}</strong></span>
                </div>
              </div>

              {/* Security & Enforcement Flags */}
              <div className="flex items-center justify-between pt-2 border-t border-base text-xs">
                <div className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-accent-500" />
                  <span className="text-muted">Strict GPS Enforcement</span>
                </div>
                <Toggle
                  checked={zone.strictGps}
                  onChange={() => {
                    setZones((prev) =>
                      prev.map((z) =>
                        z.id === zone.id ? { ...z, strictGps: !z.strictGps } : z
                      )
                    );
                  }}
                  size="sm"
                />
              </div>

              {/* Status Toggle */}
              <div className="flex items-center justify-between pt-2 border-t border-base text-xs">
                <span className="text-secondary font-medium">Zone Active</span>
                <Toggle
                  checked={zone.status === 'Active'}
                  onChange={() => toggleZoneStatus(zone.id)}
                  size="sm"
                />
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Add / Edit Geofence Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingZone ? 'Edit Geofence Zone' : 'Add Geofence Zone'}
        description="Specify GPS coordinates, radius, and network restrictions."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave}>
              {editingZone ? 'Save Changes' : 'Create Geofence'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Zone Name</Label>
            <Input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. San Francisco HQ"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Branch Office</Label>
              <Select value={formBranch} onChange={(e) => setFormBranch(e.target.value)}>
                <option value="SF HQ">SF HQ</option>
                <option value="NY Office">NY Office</option>
                <option value="London Hub">London Hub</option>
                <option value="Warehouse East">Warehouse East</option>
              </Select>
            </div>
            <div>
              <Label>Geofence Radius (meters)</Label>
              <Input
                type="number"
                min="50"
                max="2000"
                step="25"
                value={formRadius}
                onChange={(e) => setFormRadius(parseInt(e.target.value) || 100)}
              />
            </div>
          </div>

          <div>
            <Label>Physical Address</Label>
            <Input
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              placeholder="e.g. 100 Market St, Suite 400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Latitude</Label>
              <Input
                type="number"
                step="any"
                value={formLat}
                onChange={(e) => setFormLat(e.target.value)}
                placeholder="37.7749"
              />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input
                type="number"
                step="any"
                value={formLng}
                onChange={(e) => setFormLng(e.target.value)}
                placeholder="-122.4194"
              />
            </div>
          </div>

          <div>
            <Label>Allowed Wi-Fi SSID (Optional)</Label>
            <Input
              value={formWifi}
              onChange={(e) => setFormWifi(e.target.value)}
              placeholder="e.g. Acme-Corp-5G"
            />
            <p className="text-[11px] text-muted mt-1">
              If specified, mobile clock-ins will require connection to this network or GPS match.
            </p>
          </div>

          <div className="surface border border-base rounded-lg p-3 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-primary">Strict GPS Verification</div>
              <div className="text-[11px] text-secondary">
                Block check-in attempts if device GPS accuracy is low or mock location is detected.
              </div>
            </div>
            <Toggle checked={formStrictGps} onChange={() => setFormStrictGps(!formStrictGps)} size="sm" />
          </div>
        </div>
      </Modal>
    </div>
  );
}

