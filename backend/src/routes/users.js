const express = require('express');
const { z } = require('zod');

const { Roles, ALL_ROLES } = require('../constants/roles');
const { Permissions } = require('../constants/permissions');
const { requireAuth, requirePermission, requireCompanyScope } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { Role, User } = require('../models');
const { hashPassword } = require('../utils/crypto');
const { httpError } = require('../utils/httpError');
const { assertManagerLimitAvailable } = require('../services/userLimits');
const { logAudit } = require('../services/audit');

const usersRouter = express.Router();

usersRouter.use(requireAuth);

const createUserSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(8).max(200),
    roleName: z.string().min(1),
    companyId: z.string().min(1).optional(),
    isActive: z.boolean().optional(),
  }),
});

// POST /api/users - Create new user/manager
usersRouter.post(
  '/',
  requirePermission(Permissions.USERS_MANAGE),
  requireCompanyScope,
  validate(createUserSchema),
  async (req, res, next) => {
    try {
      const { name, email, password, roleName: requestedRoleName, companyId: requestedCompanyId, isActive } = req.validated.body;

      // Normalize roleName (e.g. Manager1/Manager2 or Manager)
      let roleName = requestedRoleName;
      if (roleName.toLowerCase() === 'manager') roleName = Roles.Manager;
      else if (roleName.toLowerCase() === 'manager1') roleName = Roles.Manager1;
      else if (roleName.toLowerCase() === 'manager2') roleName = Roles.Manager2;
      else if (roleName.toLowerCase() === 'company') roleName = Roles.Company;
      else if (roleName.toLowerCase() === 'superadmin') roleName = Roles.SuperAdmin;

      const companyId = req.user.role === Roles.Company ? req.user.companyId : requestedCompanyId || null;
      if (roleName !== Roles.SuperAdmin && !companyId) {
        throw httpError(400, 'COMPANY_REQUIRED', 'companyId is required');
      }
      if (req.user.role === Roles.Company && roleName === Roles.SuperAdmin) {
        throw httpError(403, 'FORBIDDEN', 'Company admins cannot create SuperAdmin users');
      }

      const existing = await User.findOne({ email: email.toLowerCase() }).lean();
      if (existing) throw httpError(409, 'EMAIL_TAKEN', 'Email already in use');

      let role = await Role.findOne({ name: roleName });
      if (!role) {
        // Fallback to Manager if not found
        role = await Role.findOne({ name: Roles.Manager });
      }
      if (!role) throw httpError(500, 'ROLE_NOT_FOUND', 'Role not found');

      await assertManagerLimitAvailable({ companyId, roleName });

      const passwordHash = await hashPassword(password);
      const user = await User.create({
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: role._id,
        company: roleName === Roles.SuperAdmin ? null : companyId,
        isActive: isActive ?? true,
      });

      // Audit Log
      await logAudit({
        userId: req.user.id,
        userEmail: req.user.email,
        companyId,
        action: 'USER_CREATE',
        resource: 'user',
        resourceId: String(user._id),
        details: { name: user.name, email: user.email, role: role.name },
        ipAddress: req.ip,
      });

      res.status(201).json({
        ok: true,
        data: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: role.name,
          companyId: user.company ? String(user.company) : null,
          isActive: user.isActive,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/users - List users
usersRouter.get(
  '/',
  requirePermission(Permissions.USERS_VIEW),
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const filter = {};
      if (req.user.role === Roles.SuperAdmin) {
        if (req.targetCompanyId) filter.company = req.targetCompanyId;
      } else {
        filter.company = req.user.companyId;
      }

      const users = await User.find(filter).populate('role').sort({ createdAt: -1 }).lean();
      res.json({
        ok: true,
        data: users.map((u) => ({
          id: String(u._id),
          name: u.name,
          email: u.email,
          role: u.role?.name,
          companyId: u.company ? String(u.company) : null,
          isActive: u.isActive,
        })),
      });
    } catch (err) {
      next(err);
    }
  }
);

const updateUserSchema = z.object({
  params: z.object({ id: z.string().min(1) }),
  body: z
    .object({
      name: z.string().min(2).max(100).optional(),
      email: z.string().email().optional(),
      roleName: z.string().optional(),
      isActive: z.boolean().optional(),
    })
    .strict(),
});

// PUT /api/users/:id - Update user
usersRouter.put(
  '/:id',
  requirePermission(Permissions.USERS_MANAGE),
  validate(updateUserSchema),
  async (req, res, next) => {
    try {
      const { id } = req.validated.params;
      const { name, email, roleName, isActive } = req.validated.body;

      const user = await User.findById(id).populate('role');
      if (!user) throw httpError(404, 'USER_NOT_FOUND', 'User not found');

      if (req.user.role === Roles.Company) {
        if (!user.company || String(user.company) !== req.user.companyId) {
          throw httpError(403, 'FORBIDDEN', 'Cannot modify users outside your company');
        }
        if (String(user._id) === req.user.id) {
          throw httpError(403, 'FORBIDDEN', 'Company owner account cannot be modified here');
        }
        if (roleName === Roles.SuperAdmin) throw httpError(403, 'FORBIDDEN', 'Cannot assign SuperAdmin role');
        if (user.role?.name === Roles.Company) throw httpError(403, 'FORBIDDEN', 'Company owner account cannot be modified here');
      }

      let nextRole = user.role;
      let nextRoleName = user.role?.name;
      if (roleName) {
        nextRole = await Role.findOne({ name: roleName }) || await Role.findOne({ name: Roles.Manager });
        if (!nextRole) throw httpError(500, 'ROLE_NOT_FOUND', 'Role not found');
        nextRoleName = nextRole.name;
      }

      const companyId = user.company ? String(user.company) : null;
      await assertManagerLimitAvailable({ companyId, roleName: nextRoleName, excludeUserId: user._id });

      if (email) {
        const normalizedEmail = email.toLowerCase();
        const emailExists = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } }).lean();
        if (emailExists) throw httpError(409, 'EMAIL_TAKEN', 'Email already in use');
        user.email = normalizedEmail;
      }
      if (name) user.name = name;
      if (roleName && nextRole) user.role = nextRole._id;
      if (typeof isActive === 'boolean') user.isActive = isActive;

      await user.save();

      // Audit Log
      await logAudit({
        userId: req.user.id,
        userEmail: req.user.email,
        companyId: user.company,
        action: 'USER_UPDATE',
        resource: 'user',
        resourceId: String(user._id),
        details: { name: user.name, email: user.email, role: nextRoleName, isActive: user.isActive },
        ipAddress: req.ip,
      });

      res.json({
        ok: true,
        data: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: nextRoleName,
          companyId,
          isActive: user.isActive,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// DELETE /api/users/:id - Delete user
usersRouter.delete(
  '/:id',
  requirePermission(Permissions.USERS_MANAGE),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const user = await User.findById(id).populate('role');
      if (!user) throw httpError(404, 'USER_NOT_FOUND', 'User not found');

      if (req.user.role === Roles.Company) {
        if (!user.company || String(user.company) !== req.user.companyId) {
          throw httpError(403, 'FORBIDDEN', 'Cannot delete users outside your company');
        }
        if (String(user._id) === req.user.id) {
          throw httpError(403, 'FORBIDDEN', 'Company owner cannot be deleted from this screen');
        }
        if (user.role?.name === Roles.Company) {
          throw httpError(403, 'FORBIDDEN', 'Company account cannot be deleted here');
        }
      }

      await user.deleteOne();

      // Audit Log
      await logAudit({
        userId: req.user.id,
        userEmail: req.user.email,
        companyId: user.company,
        action: 'USER_DELETE',
        resource: 'user',
        resourceId: String(user._id),
        details: { email: user.email, name: user.name },
        ipAddress: req.ip,
      });

      res.json({ ok: true, message: 'User deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = { usersRouter };
