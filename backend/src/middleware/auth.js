const { verifyAccessToken } = require('../utils/jwt');
const { User, Role } = require('../models');
const { Roles } = require('../constants/roles');

function normalizeRoleName(roleValue) {
  if (!roleValue) return null;

  if (typeof roleValue === 'string') {
    const normalized = roleValue.trim();
    if (!normalized) return null;
    if (normalized.toLowerCase() === 'superadmin') return Roles.SuperAdmin;
    if (normalized.toLowerCase() === 'company' || normalized.toLowerCase() === 'company_admin') return Roles.Company;
    if (normalized.toLowerCase() === 'manager') return Roles.Manager;
    if (normalized.toLowerCase() === 'manager1') return Roles.Manager1;
    if (normalized.toLowerCase() === 'manager2') return Roles.Manager2;
    return normalized;
  }

  if (typeof roleValue === 'object' && roleValue.name) {
    return normalizeRoleName(roleValue.name);
  }

  return null;
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    if (!token) {
      return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
    }

    const decoded = verifyAccessToken(token);
    let user = await User.findById(decoded.sub).populate('role').lean();
    if (!user || !user.isActive) {
      return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or inactive user' } });
    }

    let roleDoc = user.role;
    let roleName = normalizeRoleName(roleDoc);
    if (!roleName && user.role) {
      roleDoc = await Role.findById(user.role).lean();
      roleName = normalizeRoleName(roleDoc?.name);
    }

    const permissions = Array.isArray(roleDoc?.permissions) ? roleDoc.permissions : [];

    req.user = {
      id: String(user._id),
      role: roleName,
      roleId: roleDoc?._id ? String(roleDoc._id) : (user.role ? String(user.role) : null),
      permissions,
      companyId: user.company ? String(user.company) : null,
      email: user.email,
      name: user.name,
    };
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } });
  }
}

/**
 * Enforce granular permission checking.
 * Checks if req.user has ALL or ANY of the required permissions.
 * SuperAdmin automatically bypasses if needed, or by possessing all permissions.
 */
function requirePermission(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    }

    // SuperAdmin has full access
    if (req.user.role === Roles.SuperAdmin) {
      return next();
    }

    const userPerms = new Set(req.user.permissions || []);
    const hasAll = requiredPermissions.every((perm) => userPerms.has(perm));

    if (!hasAll) {
      return res.status(403).json({
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: `Permission denied. Required: ${requiredPermissions.join(', ')}`,
        },
      });
    }

    next();
  };
}

/**
 * Role-based authorization middleware (kept for compatibility, but prefer requirePermission).
 */
function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user?.role) {
      return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
    }

    // Normalize roles for comparison
    const normalizedAllowed = allowedRoles.map((r) => r.toLowerCase());
    const userRole = req.user.role.toLowerCase();

    const matched = normalizedAllowed.includes(userRole) ||
      (userRole === 'manager' && (normalizedAllowed.includes('manager1') || normalizedAllowed.includes('manager2'))) ||
      ((userRole === 'manager1' || userRole === 'manager2') && normalizedAllowed.includes('manager'));

    if (!matched) {
      return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'Insufficient role' } });
    }
    next();
  };
}

/**
 * Enforce multi-tenant isolation.
 * Automatically resolves the active companyId for the request:
 * - For SuperAdmin: allows optional query/body target companyId.
 * - For Company / Manager: strictly restricts to req.user.companyId.
 */
function requireCompanyScope(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } });
  }

  if (req.user.role === Roles.SuperAdmin) {
    req.targetCompanyId = req.query?.companyId || req.body?.companyId || null;
    return next();
  }

  if (!req.user.companyId) {
    return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'User is not associated with any company' } });
  }

  // Strictly enforce user's company
  req.targetCompanyId = req.user.companyId;
  next();
}

module.exports = {
  requireAuth,
  requirePermission,
  authorize,
  requireCompanyScope,
  normalizeRoleName,
};
