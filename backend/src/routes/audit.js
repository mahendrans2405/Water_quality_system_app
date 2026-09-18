const express = require('express');
const { z } = require('zod');

const { Permissions } = require('../constants/permissions');
const { Roles } = require('../constants/roles');
const { requireAuth, requirePermission, requireCompanyScope } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { AuditLog } = require('../models');

const auditRouter = express.Router();

auditRouter.use(requireAuth);

const listAuditSchema = z.object({
  query: z.object({
    companyId: z.string().optional(),
    action: z.string().optional(),
    resource: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).optional().default(50),
    page: z.coerce.number().int().min(1).optional().default(1),
  }),
});

// GET /api/audit-logs - Query audit trail
auditRouter.get(
  '/',
  requirePermission(Permissions.AUDIT_VIEW),
  requireCompanyScope,
  validate(listAuditSchema),
  async (req, res, next) => {
    try {
      const { action, resource, limit, page } = req.validated.query;
      const filter = {};

      if (req.user.role === Roles.SuperAdmin) {
        if (req.targetCompanyId) filter.company = req.targetCompanyId;
      } else {
        filter.company = req.user.companyId;
      }

      if (action) filter.action = action;
      if (resource) filter.resource = resource;

      const skip = (page - 1) * limit;

      const [logs, total] = await Promise.all([
        AuditLog.find(filter)
          .populate('user', 'name email')
          .populate('company', 'name')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        AuditLog.countDocuments(filter),
      ]);

      res.json({
        ok: true,
        data: {
          items: logs.map((log) => ({
            id: String(log._id),
            user: log.user ? { id: String(log.user._id), name: log.user.name, email: log.user.email } : null,
            userEmail: log.userEmail,
            company: log.company ? { id: String(log.company._id), name: log.company.name } : null,
            action: log.action,
            resource: log.resource,
            resourceId: log.resourceId,
            details: log.details,
            ipAddress: log.ipAddress,
            status: log.status,
            createdAt: log.createdAt,
          })),
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = { auditRouter };
