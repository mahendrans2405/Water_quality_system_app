const Permissions = Object.freeze({
  COMPANY_VIEW: 'company.view',
  COMPANY_MANAGE: 'company.manage',
  USERS_VIEW: 'users.view',
  USERS_MANAGE: 'users.manage',
  DEVICES_VIEW: 'devices.view',
  DEVICES_MANAGE: 'devices.manage',
  DEVICE_DATA_VIEW: 'device_data.view',
  DEVICE_DATA_DOWNLOAD: 'device_data.download',
  DEVICE_DATA_EXPORT: 'device_data.export',
  CONFIG_MANAGE: 'config.manage',
});

const ALL_PERMISSIONS = Object.freeze(Object.values(Permissions));

// Default permission mappings per role
const DEFAULT_ROLE_PERMISSIONS = Object.freeze({
  SuperAdmin: [
    Permissions.COMPANY_VIEW,
    Permissions.COMPANY_MANAGE,
    Permissions.USERS_VIEW,
    Permissions.USERS_MANAGE,
    Permissions.DEVICES_VIEW,
    Permissions.DEVICES_MANAGE,
    Permissions.DEVICE_DATA_VIEW,
    Permissions.DEVICE_DATA_DOWNLOAD,
    Permissions.DEVICE_DATA_EXPORT,
    Permissions.CONFIG_MANAGE,
  ],
  Company: [
    Permissions.COMPANY_VIEW,
    Permissions.DEVICES_VIEW,
    Permissions.DEVICE_DATA_VIEW,
    Permissions.DEVICE_DATA_DOWNLOAD,
    Permissions.DEVICE_DATA_EXPORT,
  ],
  Manager: [
    Permissions.COMPANY_VIEW,
    Permissions.DEVICES_VIEW,
    Permissions.DEVICE_DATA_VIEW,
    // Strictly view-only; no download or export
  ],
});

module.exports = {
  Permissions,
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
};
