const { Roles } = require('../constants/roles');
const { Role, User, Company } = require('../models');
const { httpError } = require('../utils/httpError');

async function assertManagerLimitAvailable({ companyId, roleName, excludeUserId = null }) {
  if (![Roles.Manager1, Roles.Manager2].includes(roleName)) return;
  if (!companyId) throw httpError(400, 'COMPANY_REQUIRED', 'Company is required for manager roles');

  const company = await Company.findById(companyId).lean();
  if (!company) throw httpError(404, 'COMPANY_NOT_FOUND', 'Company not found');

  const role = await Role.findOne({ name: roleName }).lean();
  if (!role) throw httpError(500, 'ROLE_NOT_FOUND', 'Role not found');

  const query = { company: companyId, role: role._id, isActive: true };
  if (excludeUserId) query._id = { $ne: excludeUserId };

  const count = await User.countDocuments(query);
  const max = (roleName === Roles.Manager1 ? company.maxManagers?.manager1 : company.maxManagers?.manager2) ?? 2;
  if (count >= max) {
    throw httpError(
      409,
      'MANAGER_LIMIT_REACHED',
      `Max ${roleName} users reached for this company (${max})`
    );
  }
}

module.exports = { assertManagerLimitAvailable };

