const { Role, User, Company } = require('../models');
const { Roles } = require('../constants/roles');
const { DEFAULT_ROLE_PERMISSIONS, Permissions } = require('../constants/permissions');
const { hashPassword } = require('./crypto');

async function ensureRolesSeeded() {
  const roleDefinitions = [
    { name: Roles.SuperAdmin, permissions: DEFAULT_ROLE_PERMISSIONS.SuperAdmin },
    { name: Roles.Company, permissions: DEFAULT_ROLE_PERMISSIONS.Company },
    { name: Roles.Manager, permissions: DEFAULT_ROLE_PERMISSIONS.Manager },
    // Backwards-compatible aliases for legacy systems
    { name: Roles.Manager1, permissions: DEFAULT_ROLE_PERMISSIONS.Manager },
    { name: Roles.Manager2, permissions: DEFAULT_ROLE_PERMISSIONS.Manager },
  ];

  const created = [];
  const updated = [];

  for (const def of roleDefinitions) {
    const existing = await Role.findOne({ name: def.name });
    if (!existing) {
      await Role.create(def);
      created.push(def.name);
    } else {
      // Ensure permissions are up to date with the recommended matrix
      existing.permissions = def.permissions;
      await existing.save();
      updated.push(def.name);
    }
  }

  // Ensure legacy string roles are converted to Role ObjectIds
  await normalizeLegacyUsers();

  // Ensure legacy companies have maxManagers configured
  await normalizeLegacyCompanies();

  // Ensure SuperAdmin user exists
  await ensureSuperAdminExists();

  return { created, updated };
}

async function normalizeLegacyUsers() {
  try {
    const roles = await Role.find({}).lean();
    const roleMap = {};
    for (const r of roles) {
      roleMap[r.name.toLowerCase()] = r._id;
    }
    roleMap['superadmin'] = roleMap['superadmin'];
    roleMap['company_admin'] = roleMap['company'];
    roleMap['company'] = roleMap['company'];
    roleMap['manager'] = roleMap['manager'] || roleMap['manager1'];
    roleMap['manager1'] = roleMap['manager1'] || roleMap['manager'];
    roleMap['manager2'] = roleMap['manager2'] || roleMap['manager'];

    const rawUsers = await User.collection.find({}).toArray();
    for (const u of rawUsers) {
      const update = {};
      if (typeof u.role === 'string') {
        const targetRoleId = roleMap[u.role.toLowerCase()] || roleMap['manager'];
        if (targetRoleId) {
          update.role = targetRoleId;
        }
      }
      if (u.companyId && !u.company) {
        update.company = u.companyId;
      }
      if (u.password && !u.passwordHash) {
        if (u.password.startsWith('$2a$') || u.password.startsWith('$2b$')) {
          update.passwordHash = u.password;
        } else {
          update.passwordHash = await hashPassword(u.password);
        }
      }
      if (Object.keys(update).length > 0) {
        await User.collection.updateOne({ _id: u._id }, { $set: update });
      }
    }
  } catch (err) {
    console.warn('User normalization warning:', err?.message || err);
  }
}

async function normalizeLegacyCompanies() {
  try {
    const rawCompanies = await Company.collection.find({}).toArray();
    for (const c of rawCompanies) {
      const update = {};
      if (!c.maxManagers || typeof c.maxManagers.manager1 !== 'number' || typeof c.maxManagers.manager2 !== 'number') {
        const total = c.managerLimit || 4;
        update.maxManagers = {
          manager1: Math.ceil(total / 2) || 2,
          manager2: Math.floor(total / 2) || 2,
        };
      }
      if (!Array.isArray(c.branches) || c.branches.length === 0) {
        update.branches = [
          { name: 'Main Branch', code: 'MAIN', address: c.address || '', units: [{ name: 'Unit 1', description: 'Primary Treatment Unit' }] }
        ];
      }
      if (Object.keys(update).length > 0) {
        await Company.collection.updateOne({ _id: c._id }, { $set: update });
      }
    }

    const { Device } = require('../models/Device');
    const rawDevices = await Device.collection.find({}).toArray();
    for (const d of rawDevices) {
      if (!d.branch || !d.unit) {
        await Device.collection.updateOne(
          { _id: d._id },
          { $set: { branch: d.branch || 'Main Branch', unit: d.unit || 'Unit 1' } }
        );
      }
    }
  } catch (err) {
    console.warn('Company/device normalization warning:', err?.message || err);
  }
}

async function ensureSuperAdminExists() {
  const existingSuperAdmin = await User.findOne({
    email: { $in: ['superadmin', 'superadmin@system.local'] },
  }).lean();
  if (existingSuperAdmin) {
    return; // SuperAdmin already exists
  }

  try {
    const superAdminRole = await Role.findOne({ name: Roles.SuperAdmin });
    if (!superAdminRole) {
      console.warn('SuperAdmin role not found, cannot create SuperAdmin user');
      return;
    }

    const passwordHash = await hashPassword('12345678');
    await User.create({
      name: 'SuperAdmin',
      email: 'superadmin@system.local',
      passwordHash,
      role: superAdminRole._id,
      company: null,
      isActive: true,
    });

    console.log('SuperAdmin user created successfully with default credentials');
  } catch (err) {
    console.warn('Failed to create SuperAdmin user:', err?.message || err);
  }
}

module.exports = { ensureRolesSeeded };
