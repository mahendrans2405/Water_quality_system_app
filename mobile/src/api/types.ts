export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: any };

export type FieldMapping = {
  fieldNumber: number;
  parameterName: string;
  unit: string;
  dataType?: 'number' | 'string' | 'boolean';
  displayFormat?: string;
  minThreshold?: number | null;
  maxThreshold?: number | null;
};

export type Unit = {
  _id?: string;
  name: string;
  description?: string;
};

export type Branch = {
  _id?: string;
  name: string;
  code?: string;
  address?: string;
  units: Unit[];
};

export type Company = {
  id: string;
  name: string;
  address?: string;
  branches?: Branch[];
  maxManagers?: {
    total: number;
    manager1: number;
    manager2: number;
  };
  ownerId?: string | null;
};

export type DeviceSummary = {
  id: string;
  deviceId: string;
  name: string;
  deviceType: string;
  channelId: string;
  hasReadKey: boolean;
  branch?: string;
  unit?: string;
  location?: string;
  status: 'Online' | 'Offline' | 'Warning' | 'Danger' | 'No Recent Data';
  lastDataReceived: string | null;
  offlineThresholdMinutes: number;
  fieldMappings: FieldMapping[];
  assignedManager?: string | null;
  assignedManagerUser?: {
    id: string;
    name: string;
    email: string;
  } | null;
  companyId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type TelemetryParameter = {
  fieldNumber: number;
  value: number | string | null;
  unit: string;
  minThreshold?: number | null;
  maxThreshold?: number | null;
  severity?: 'NORMAL' | 'ALERT' | 'WARNING' | 'DANGER';
  targetDesc?: string;
};

export type TelemetryRecord = {
  id: string;
  timestamp: string;
  parameters: Record<string, TelemetryParameter>;
  alerts: string[];
  severity?: 'NORMAL' | 'ALERT' | 'WARNING' | 'DANGER';
  status?: 'Safe' | 'Alert' | 'Warning' | 'Danger' | string;
  isSafe?: boolean;
  isWarning: boolean;
  raw?: any;
};

export type DeviceLiveResponse = {
  deviceId: string;
  name: string;
  status: 'Online' | 'Offline' | 'Warning' | 'Danger' | 'No Recent Data';
  telemetry: TelemetryRecord | null;
  isStale: boolean;
  fieldMappings: FieldMapping[];
  lastDataReceived: string | null;
};

export type DeviceHistoryResponse = {
  deviceId: string;
  name: string;
  fieldMappings: FieldMapping[];
  range: { range: string; start?: string; end?: string };
  total: number;
  items: TelemetryRecord[];
  isStale: boolean;
};

export type IotSummaryStats = {
  totalDevices: number;
  onlineDevices: number;
  offlineDevices: number;
  warningDevices: number;
  noDataDevices: number;
  companyId?: string;
};

export type AuditLogRecord = {
  id: string;
  user?: { id: string; name: string; email: string } | null;
  userEmail: string;
  company?: { id: string; name: string } | null;
  action: string;
  resource: string;
  resourceId?: string;
  details?: any;
  ipAddress?: string;
  status: 'SUCCESS' | 'FAILURE';
  createdAt: string;
};

export type WaterStats = {
  range: { from: string | null; to: string | null };
  count: number;
  averages: {
    pH: number | null;
    turbidity: number | null;
    dissolvedOxygen: number | null;
    temperature: number | null;
  };
  latest: any | null;
  latestStatus: { alerts: string[]; isSafe: boolean } | null;
  alerts24h: { total: number; breakdown: Record<string, number> };
};
