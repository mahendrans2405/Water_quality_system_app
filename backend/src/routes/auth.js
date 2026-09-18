const express = require('express');
const { z } = require('zod');

const { validate } = require('../middleware/validate');
const { env } = require('../utils/env');
const { Roles } = require('../constants/roles');
const { Role, User, Company, Config } = require('../models');
const { hashPassword, verifyPassword, hashToken, verifyTokenHash } = require('../utils/crypto');
const { signAccessToken, signRefreshToken, verifyRefreshToken, verifyAccessToken } = require('../utils/jwt');
const { requireAuth, authorize } = require('../middleware/auth');

const authRouter = express.Router();

const registerSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    password: z.string().min(8).max(200),
    companyName: z.string().min(2).max(200).optional(),
  }),
});

authRouter.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { name, email, password, companyName } = req.validated.body;

    const usersCount = await User.estimatedDocumentCount();
    const isFirstUser = usersCount === 0;

    // Policy:
    // - If first user: allow and create SuperAdmin.
    // - Else: allow if ALLOW_OPEN_REGISTRATION=true, otherwise require authenticated SuperAdmin.
    if (!isFirstUser && !env.ALLOW_OPEN_REGISTRATION) {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
      if (!token) {
        return res.status(403).json({
          ok: false,
          error: { code: 'REGISTRATION_CLOSED', message: 'Registration is restricted' },
        });
      }
      try {
        const decoded = verifyAccessToken(token);
        const requester = await User.findById(decoded.sub).populate('role').lean();
        if (!requester || requester.role?.name !== Roles.SuperAdmin) {
          return res.status(403).json({
            ok: false,
            error: { code: 'REGISTRATION_CLOSED', message: 'Registration is restricted' },
          });
        }
      } catch {
        return res.status(403).json({
          ok: false,
          error: { code: 'REGISTRATION_CLOSED', message: 'Registration is restricted' },
        });
      }
    }

    const existing = await User.findOne({ email: email.toLowerCase() }).lean();
    if (existing) {
      return res.status(409).json({ ok: false, error: { code: 'EMAIL_TAKEN', message: 'Email already in use' } });
    }

    let roleName = Roles.Company;
    if (isFirstUser) roleName = Roles.SuperAdmin;

    const role = await Role.findOne({ name: roleName });
    if (!role) {
      return res.status(500).json({
        ok: false,
        error: {
          code: 'ROLES_NOT_SEEDED',
          message: 'Roles are not initialized yet. Run seed on startup (coming next step).',
        },
      });
    }

    let companyId = null;
    if (roleName !== Roles.SuperAdmin) {
      if (!companyName) {
        return res.status(400).json({
          ok: false,
          error: { code: 'COMPANY_REQUIRED', message: 'companyName is required for non-SuperAdmin registration' },
        });
      }
      const company = await Company.create({ name: companyName, address: '' });
      await Config.create({ company: company._id });
      companyId = company._id;
    }

    const passwordHash = await hashPassword(password);
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      passwordHash,
      role: role._id,
      company: companyId,
      isActive: true,
    });

    const accessToken = signAccessToken({
      sub: String(user._id),
      role: roleName,
      companyId: companyId ? String(companyId) : null,
    });
    const refreshToken = signRefreshToken({
      sub: String(user._id),
      role: roleName,
      companyId: companyId ? String(companyId) : null,
    });

    user.refreshTokenHash = await hashToken(refreshToken);
    user.refreshTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await user.save();

    res.status(201).json({
      ok: true,
      data: {
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: roleName,
          companyId,
          permissions: role.permissions || [],
        },
        tokens: { accessToken, refreshToken },
      },
    });
  } catch (err) {
    next(err);
  }
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().min(1),
    password: z.string().min(1),
  }),
});

authRouter.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.validated.body;
    const normalizedInput = email.trim().toLowerCase();
    const user = await User.findOne({
      $or: [
        { email: normalizedInput },
        ...(normalizedInput === 'superadmin' ? [{ email: 'superadmin@system.local' }] : []),
        ...(normalizedInput === 'superadmin@system.local' ? [{ email: 'superadmin' }] : []),
      ],
    }).populate('role');
    if (!user || !user.isActive) {
      return res.status(401).json({ ok: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid login' } });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ ok: false, error: { code: 'INVALID_CREDENTIALS', message: 'Invalid login' } });
    }

    const roleName = user.role?.name;
    const companyId = user.company ? String(user.company) : null;

    const accessToken = signAccessToken({
      sub: String(user._id),
      role: roleName,
      companyId,
    });
    const refreshToken = signRefreshToken({
      sub: String(user._id),
      role: roleName,
      companyId,
    });

    user.refreshTokenHash = await hashToken(refreshToken);
    user.refreshTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await user.save();

    const permissions = user.role?.permissions || [];

    res.json({
      ok: true,
      data: {
        user: {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: roleName,
          companyId,
          permissions,
        },
        tokens: { accessToken, refreshToken },
      },
    });
  } catch (err) {
    next(err);
  }
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(10),
  }),
});

authRouter.post('/refresh-token', validate(refreshSchema), async (req, res, next) => {
  try {
    const { refreshToken } = req.validated.body;

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch {
      return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' } });
    }

    const user = await User.findById(decoded.sub).populate('role');
    if (!user || !user.isActive) {
      return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid user' } });
    }

    const notExpired = user.refreshTokenExpiresAt && user.refreshTokenExpiresAt.getTime() > Date.now();
    if (!notExpired) {
      return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Refresh token expired' } });
    }

    const matches = await verifyTokenHash(refreshToken, user.refreshTokenHash);
    if (!matches) {
      return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Refresh token revoked' } });
    }

    const roleName = user.role?.name;
    const companyId = user.company ? String(user.company) : null;

    const accessToken = signAccessToken({ sub: String(user._id), role: roleName, companyId });
    const newRefreshToken = signRefreshToken({ sub: String(user._id), role: roleName, companyId });

    user.refreshTokenHash = await hashToken(newRefreshToken);
    user.refreshTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await user.save();

    res.json({ ok: true, data: { tokens: { accessToken, refreshToken: newRefreshToken } } });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me - Current user profile & active permissions
authRouter.get('/me', requireAuth, async (req, res) => {
  res.json({
    ok: true,
    data: {
      user: {
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        companyId: req.user.companyId,
        permissions: req.user.permissions || [],
      },
    },
  });
});

// Utility: seed roles endpoint (protected)
authRouter.post('/seed-roles', requireAuth, authorize(Roles.SuperAdmin), async (req, res, next) => {
  try {
    const roleNames = Object.values(Roles);
    const existing = await Role.find({ name: { $in: roleNames } }).lean();
    const existingNames = new Set(existing.map((r) => r.name));

    const toCreate = roleNames.filter((r) => !existingNames.has(r)).map((name) => ({ name, permissions: [] }));
    if (toCreate.length) await Role.insertMany(toCreate);

    res.json({ ok: true, data: { created: toCreate.map((r) => r.name), existing: [...existingNames] } });
  } catch (err) {
    next(err);
  }
});

module.exports = { authRouter };

