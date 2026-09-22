const express = require('express');
const { z } = require('zod');

const { Permissions } = require('../constants/permissions');
const { Roles } = require('../constants/roles');
const { requireAuth, requirePermission, requireCompanyScope, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { Device, User } = require('../models');
const { httpError } = require('../utils/httpError');
const { logAudit } = require('../services/audit');
const { ioTDataService } = require('../services/iot');

const devicesRouter = express.Router();

devicesRouter.use(requireAuth);

/**
 * Format device doc for safe client transmission (removes private keys).
 */
function sanitizeDevice(d) {
  return {
    id: String(d._id),
    deviceId: d.deviceId,
    name: d.name || d.deviceId,
    deviceType: d.deviceType || 'Water Quality Monitor',
    channelId: d.channelId,
    hasReadKey: Boolean(d.readKey),
    branch: d.branch || '',
    unit: d.unit || '',
    location: d.location || '',
    status: d.status || 'No Recent Data',
    lastDataReceived: d.lastDataReceived || null,
    offlineThresholdMinutes: d.offlineThresholdMinutes || 30,
    fieldMappings: d.fieldMappings || [],
    assignedManager: d.assignedManager ? String(d.assignedManager._id || d.assignedManager) : null,
    assignedManagerUser: d.assignedManager && d.assignedManager.name
      ? { id: String(d.assignedManager._id), name: d.assignedManager.name, email: d.assignedManager.email }
      : null,
    isActive: d.isActive,
    companyId: String(d.company),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

const listSchema = z.object({
  query: z.object({
    companyId: z.string().optional(),
    branch: z.string().optional(),
    unit: z.string().optional(),
    status: z.enum(['Online', 'Offline', 'Warning', 'No Recent Data']).optional(),
  }),
});

// GET /api/devices - List devices scoped by role and tenant
devicesRouter.get(
  '/',
  requirePermission(Permissions.DEVICES_VIEW),
  requireCompanyScope,
  validate(listSchema),
  async (req, res, next) => {
    try {
      const filter = {};
      const { branch, unit, status } = req.validated.query;

      if (req.user.role === Roles.SuperAdmin) {
        const cId = req.validated.query.companyId || req.targetCompanyId;
        if (cId) filter.company = cId;
        if (branch) filter.branch = branch;
        if (unit) filter.unit = unit;
      } else if (req.user.role === Roles.Company) {
        filter.company = req.user.companyId;
        if (branch) filter.branch = branch;
        if (unit) filter.unit = unit;
      } else {
        // Manager role: strictly scoped to company and assigned branch/unit/devices
        filter.company = req.user.companyId;
        if (req.user.branch) {
          filter.branch = req.user.branch;
        } else if (branch) {
          filter.branch = branch;
        }

        if (req.user.unit) {
          filter.unit = req.user.unit;
        } else if (unit) {
          filter.unit = unit;
        }
        if (Array.isArray(req.user.assignedDevices) && req.user.assignedDevices.length > 0) {
          filter._id = { $in: req.user.assignedDevices };
        } else {
          const assignedCount = await Device.countDocuments({ company: req.user.companyId, assignedManager: req.user.id });
          if (assignedCount > 0) {
            filter.assignedManager = req.user.id;
          }
        }
      }

      if (status) {
        filter.status = status;
      }

      const devices = await Device.find(filter)
        .populate('assignedManager', 'name email')
        .sort({ createdAt: -1 })
        .lean();

      res.json({
        ok: true,
        data: devices.map(sanitizeDevice),
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/devices/:id - Single device details
devicesRouter.get(
  '/:id',
  requirePermission(Permissions.DEVICES_VIEW),
  async (req, res, next) => {
    try {
      const device = await Device.findById(req.params.id).populate('assignedManager', 'name email').lean();
      if (!device) throw httpError(404, 'DEVICE_NOT_FOUND', 'Device not found');

      // Tenant check
      if (req.user.role !== Roles.SuperAdmin && String(device.company) !== req.user.companyId) {
        throw httpError(403, 'FORBIDDEN', 'Access denied to this device');
      }

      res.json({
        ok: true,
        data: sanitizeDevice(device),
      });
    } catch (err) {
      next(err);
    }
  }
);

const fieldMappingSchema = z.object({
  fieldNumber: z.number().int().min(1).max(8),
  parameterName: z.string().min(1).max(100),
  unit: z.string().max(50).optional().default(''),
  dataType: z.enum(['number', 'string', 'boolean']).optional().default('number'),
  displayFormat: z.string().max(20).optional().default('0.00'),
  minThreshold: z.number().nullable().optional(),
  maxThreshold: z.number().nullable().optional(),
});

const createDeviceSchema = z.object({
  body: z.object({
    deviceId: z.string().min(1).max(100),
    name: z.string().min(1).max(100).optional(),
    deviceType: z.string().max(100).optional(),
    channelId: z.string().min(1).max(200),
    readKey: z.string().min(1).max(200),
    writeKey: z.string().max(200).optional(),
    companyId: z.string().min(1),
    branch: z.string().max(200).optional(),
    unit: z.string().max(200).optional(),
    location: z.string().max(200).optional(),
    assignedManager: z.string().nullable().optional(),
    offlineThresholdMinutes: z.number().int().min(1).max(1440).optional(),
    fieldMappings: z.array(fieldMappingSchema).optional(),
  }),
});

// POST /api/devices - Create device (SuperAdmin ONLY)
devicesRouter.post(
  '/',
  authorize(Roles.SuperAdmin),
  validate(createDeviceSchema),
  async (req, res, next) => {
    try {
      const {
        deviceId,
        name,
        deviceType,
        channelId,
        readKey,
        writeKey,
        companyId,
        branch,
        unit,
        location,
        assignedManager,
        offlineThresholdMinutes,
        fieldMappings,
      } = req.validated.body;

      if (!companyId) throw httpError(400, 'COMPANY_REQUIRED', 'Company is required');

      const existingByDeviceId = await Device.findOne({ company: companyId, deviceId }).lean();
      if (existingByDeviceId) throw httpError(409, 'DEVICE_EXISTS', 'A device with this Device ID already exists in this company');

      const existingByChannel = await Device.findOne({ company: companyId, channelId }).lean();
      if (existingByChannel) throw httpError(409, 'CHANNEL_EXISTS', 'This ThingSpeak channel is already assigned to a device in this company');

      const device = await Device.create({
        company: companyId,
        deviceId: deviceId.trim(),
        name: (name || deviceId).trim(),
        deviceType: (deviceType || 'Water Quality Monitor').trim(),
        channelId: channelId.trim(),
        readKey: readKey.trim(),
        writeKey: writeKey ? writeKey.trim() : '',
        branch: (branch || '').trim(),
        unit: (unit || '').trim(),
        location: (location || '').trim(),
        assignedManager: assignedManager || null,
        offlineThresholdMinutes: offlineThresholdMinutes || 30,
        fieldMappings: fieldMappings && fieldMappings.length > 0 ? fieldMappings : undefined,
        createdBy: req.user.id,
        isActive: true,
      });

      res.status(201).json({
        ok: true,
        data: sanitizeDevice(device),
      });
    } catch (err) {
      next(err);
    }
  }
);

const updateDeviceSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z.object({
    deviceId: z.string().min(1).max(100).optional(),
    name: z.string().min(1).max(100).optional(),
    deviceType: z.string().max(100).optional(),
    channelId: z.string().min(1).max(200).optional(),
    readKey: z.string().min(1).max(200).optional(),
    writeKey: z.string().max(200).optional(),
    branch: z.string().max(200).optional(),
    unit: z.string().max(200).optional(),
    location: z.string().max(200).optional(),
    assignedManager: z.string().nullable().optional(),
    offlineThresholdMinutes: z.number().int().min(1).max(1440).optional(),
    fieldMappings: z.array(fieldMappingSchema).optional(),
    isActive: z.boolean().optional(),
  }),
});

// PUT /api/devices/:id - Update device (SuperAdmin ONLY)
devicesRouter.put(
  '/:id',
  authorize(Roles.SuperAdmin),
  validate(updateDeviceSchema),
  async (req, res, next) => {
    try {
      const device = await Device.findById(req.validated.params.id);
      if (!device) throw httpError(404, 'DEVICE_NOT_FOUND', 'Device not found');

      const body = req.validated.body;
      if (body.deviceId) device.deviceId = body.deviceId.trim();
      if (body.name !== undefined) device.name = body.name.trim();
      if (body.deviceType !== undefined) device.deviceType = body.deviceType.trim();
      if (body.channelId) {
        device.channelId = body.channelId.trim();
        ioTDataService.invalidateCache(device.channelId);
      }
      if (body.readKey) {
        device.readKey = body.readKey.trim();
        ioTDataService.invalidateCache(device.channelId);
      }
      if (body.writeKey !== undefined) device.writeKey = body.writeKey.trim();
      if (body.branch !== undefined) device.branch = body.branch.trim();
      if (body.unit !== undefined) device.unit = body.unit.trim();
      if (body.location !== undefined) device.location = body.location.trim();
      if (body.assignedManager !== undefined) device.assignedManager = body.assignedManager || null;
      if (body.offlineThresholdMinutes !== undefined) device.offlineThresholdMinutes = body.offlineThresholdMinutes;
      if (body.fieldMappings !== undefined) device.fieldMappings = body.fieldMappings;
      if (typeof body.isActive === 'boolean') device.isActive = body.isActive;

      await device.save();

      res.json({
        ok: true,
        data: sanitizeDevice(device),
      });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/devices/:id - Delete device (SuperAdmin ONLY)
devicesRouter.delete(
  '/:id',
  authorize(Roles.SuperAdmin),
  async (req, res, next) => {
    try {
      const device = await Device.findById(req.params.id);
      if (!device) throw httpError(404, 'DEVICE_NOT_FOUND', 'Device not found');

      ioTDataService.invalidateCache(device.channelId);
      await device.deleteOne();

      res.json({ ok: true, message: 'Device deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = { devicesRouter };
