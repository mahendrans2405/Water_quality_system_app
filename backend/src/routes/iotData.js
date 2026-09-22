const express = require('express');
const { z } = require('zod');

const { Permissions } = require('../constants/permissions');
const { Roles } = require('../constants/roles');
const { requireAuth, requirePermission, requireCompanyScope } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { Device } = require('../models');
const { httpError } = require('../utils/httpError');
const { ioTDataService } = require('../services/iot');
const { logAudit } = require('../services/audit');

const iotRouter = express.Router();

iotRouter.use(requireAuth);

/**
 * Verify device tenant access for current user.
 */
async function getAuthorizedDevice(deviceIdOrMongoId, user) {
  const query = {
    $or: [{ _id: deviceIdOrMongoId.match(/^[0-9a-fA-F]{24}$/) ? deviceIdOrMongoId : null }, { deviceId: deviceIdOrMongoId }].filter(Boolean),
  };

  const device = await Device.findOne(query);
  if (!device) throw httpError(404, 'DEVICE_NOT_FOUND', 'Device not found');

  // Strict company isolation
  if (user.role !== Roles.SuperAdmin && String(device.company) !== user.companyId) {
    throw httpError(403, 'FORBIDDEN', 'Access denied: You cannot access devices from another company');
  }

  // Scoping for Manager role (branch, unit, assigned devices)
  const isManager = user.role === Roles.Manager || user.role === Roles.Manager1 || user.role === Roles.Manager2;
  if (isManager) {
    if (user.branch && device.branch && user.branch.toLowerCase() !== device.branch.toLowerCase()) {
      throw httpError(403, 'FORBIDDEN', 'Access denied: Device belongs to another branch');
    }
    if (user.unit && device.unit && user.unit.toLowerCase() !== device.unit.toLowerCase()) {
      throw httpError(403, 'FORBIDDEN', 'Access denied: Device belongs to another unit');
    }
    if (Array.isArray(user.assignedDevices) && user.assignedDevices.length > 0) {
      if (!user.assignedDevices.includes(String(device._id))) {
        throw httpError(403, 'FORBIDDEN', 'Access denied: This device is not assigned to your account');
      }
    } else {
      const assignedCount = await Device.countDocuments({ company: user.companyId, assignedManager: user.id });
      if (assignedCount > 0 && String(device.assignedManager) !== user.id) {
        throw httpError(403, 'FORBIDDEN', 'This device is not assigned to you');
      }
    }
  }

  return device;
}

// GET /api/iot/devices/:id/live - Fetch live sensor telemetry
iotRouter.get(
  '/devices/:id/live',
  requirePermission(Permissions.DEVICE_DATA_VIEW),
  async (req, res, next) => {
    try {
      const device = await getAuthorizedDevice(req.params.id, req.user);
      const result = await ioTDataService.getLiveTelemetry(device);

      res.json({
        ok: true,
        data: {
          deviceId: device.deviceId,
          name: device.name,
          status: result.status,
          telemetry: result.telemetry,
          isStale: result.isStale,
          fieldMappings: device.fieldMappings,
          lastDataReceived: device.lastDataReceived,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

const historyQuerySchema = z.object({
  query: z.object({
    range: z.enum(['latest', '1h', '6h', '1d', '24h', '7d', '30d', 'custom']).optional().default('1d'),
    start: z.string().optional(),
    end: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  }),
});

// GET /api/iot/devices/:id/telemetry - Fetch time series historical data
iotRouter.get(
  '/devices/:id/telemetry',
  requirePermission(Permissions.DEVICE_DATA_VIEW),
  validate(historyQuerySchema),
  async (req, res, next) => {
    try {
      const device = await getAuthorizedDevice(req.params.id, req.user);
      const { range, start: customStart, end: customEnd, limit } = req.validated.query;

      let start = undefined;
      let end = undefined;

      if (range === 'custom') {
        if (customStart) {
          const d = new Date(customStart);
          if (!isNaN(d.getTime())) start = d.toISOString();
        }
        if (customEnd) {
          const d = new Date(customEnd);
          if (!isNaN(d.getTime())) end = d.toISOString();
        }
      } else if (range !== 'latest') {
        const now = Date.now();
        const rangeMs = {
          '1h': 60 * 60 * 1000,
          '6h': 6 * 60 * 60 * 1000,
          '1d': 24 * 60 * 60 * 1000,
          '24h': 24 * 60 * 60 * 1000,
          '7d': 7 * 24 * 60 * 60 * 1000,
          '30d': 30 * 24 * 60 * 60 * 1000,
        }[range];

        if (rangeMs) {
          start = new Date(now - rangeMs).toISOString();
          end = new Date(now).toISOString();
        }
      }

      const result = await ioTDataService.getTelemetryHistory(device, {
        results: limit,
        start,
        end,
      });

      res.json({
        ok: true,
        data: {
          deviceId: device.deviceId,
          name: device.name,
          fieldMappings: device.fieldMappings,
          range: { range, start, end },
          total: result.total,
          items: result.items,
          isStale: result.isStale,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

const exportQuerySchema = z.object({
  query: z.object({
    range: z.enum(['latest', '1h', '6h', '1d', '24h', '7d', '30d', 'custom']).optional().default('1d'),
    start: z.string().optional(),
    end: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(1000).optional().default(500),
  }),
});

// GET /api/iot/devices/:id/export - Download telemetry CSV (Restricted to SuperAdmin and Company Admin)
iotRouter.get(
  '/devices/:id/export',
  requirePermission(Permissions.DEVICE_DATA_DOWNLOAD),
  validate(exportQuerySchema),
  async (req, res, next) => {
    try {
      const device = await getAuthorizedDevice(req.params.id, req.user);
      const { range, start: customStart, end: customEnd, limit } = req.validated.query;

      let start = undefined;
      let end = undefined;

      if (range === 'custom') {
        if (customStart) {
          const d = new Date(customStart);
          if (!isNaN(d.getTime())) start = d.toISOString();
        }
        if (customEnd) {
          const d = new Date(customEnd);
          if (!isNaN(d.getTime())) end = d.toISOString();
        }
      } else if (range !== 'latest') {
        const now = Date.now();
        const rangeMs = {
          '1h': 60 * 60 * 1000,
          '6h': 6 * 60 * 60 * 1000,
          '1d': 24 * 60 * 60 * 1000,
          '24h': 24 * 60 * 60 * 1000,
          '7d': 7 * 24 * 60 * 60 * 1000,
          '30d': 30 * 24 * 60 * 60 * 1000,
        }[range];

        if (rangeMs) {
          start = new Date(now - rangeMs).toISOString();
          end = new Date(now).toISOString();
        }
      }

      let result;
      try {
        result = await ioTDataService.getTelemetryHistory(device, {
          results: limit,
          start,
          end,
        });
      } catch (historyErr) {
        result = { items: [], isStale: true };
      }

      // Generate CSV
      const mappings = device.fieldMappings && device.fieldMappings.length > 0
        ? device.fieldMappings
        : [
            { parameterName: 'pH', unit: 'pH' },
            { parameterName: 'Turbidity', unit: 'NTU' },
            { parameterName: 'TDS', unit: 'ppm' },
          ];

      const headerCols = ['Timestamp', 'Device ID', 'Device Name'];
      mappings.forEach((m, idx) => {
        headerCols.push(`Value ${m.fieldNumber || idx + 1}`);
      });
      headerCols.push('Status');

      const csvRows = [headerCols.join(',')];

      for (const item of result.items) {
        const row = [
          `"${new Date(item.timestamp).toISOString()}"`,
          `"${device.deviceId}"`,
          `"${device.name || device.deviceId}"`,
        ];

        for (const m of mappings) {
          const val = item.parameters?.[m.parameterName]?.value;
          row.push(val !== null && val !== undefined ? String(val) : '');
        }

        const readingStatus = item.status || (item.alerts && item.alerts.length > 0 ? 'Warning' : 'Safe');
        row.push(`"${readingStatus}"`);

        csvRows.push(row.join(','));
      }

      const csvContent = csvRows.join('\r\n');

      // Audit Log for Download Operation
      await logAudit({
        userId: req.user.id,
        userEmail: req.user.email,
        companyId: device.company,
        action: 'DATA_DOWNLOAD',
        resource: 'device_data',
        resourceId: String(device._id),
        details: {
          deviceId: device.deviceId,
          recordCount: result.items.length,
          range,
          format: 'CSV',
        },
        ipAddress: req.ip,
      });

      const filename = `device_${device.deviceId}_${range}_${Date.now()}.csv`;
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send(csvContent);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/iot/summary - High-level IoT device statistics for dashboard
iotRouter.get(
  '/summary',
  requirePermission(Permissions.DEVICES_VIEW),
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const filter = {};
      if (req.user.role === Roles.SuperAdmin) {
        if (req.targetCompanyId) filter.company = req.targetCompanyId;
      } else {
        filter.company = req.user.companyId;
      }

      const devices = await Device.find(filter).lean();

      let online = 0;
      let offline = 0;
      let warning = 0;
      let noData = 0;

      for (const d of devices) {
        const status = ioTDataService.calculateDeviceStatus(d.lastDataReceived, d.offlineThresholdMinutes, false);
        if (status === 'Online') online += 1;
        else if (status === 'Offline') offline += 1;
        else if (status === 'Warning') warning += 1;
        else noData += 1;
      }

      res.json({
        ok: true,
        data: {
          totalDevices: devices.length,
          onlineDevices: online,
          offlineDevices: offline,
          warningDevices: warning,
          noDataDevices: noData,
          companyId: req.targetCompanyId || req.user.companyId,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = { iotRouter };
