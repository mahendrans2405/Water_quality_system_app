const { Roles } = require('../constants/roles');
const { Role, User, Company } = require('../models');
const { httpError } = require('../utils/httpError');

async function assertManagerLimitAvailable({ companyId, roleName, excludeUserId = null }) {
  if (![Roles.Manager, Roles.Manager1, Roles.Manager2].includes(roleName)) return;
  if (!companyId) throw httpError(400, 'COMPANY_REQUIRED', 'Company is required for manager roles');

  const company = await Company.findById(companyId).lean();
  if (!company) throw httpError(404, 'COMPANY_NOT_FOUND', 'Company not found');

  const managerRoles = await Role.find({ name: { $in: [Roles.Manager, Roles.Manager1, Roles.Manager2] } }).select('_id').lean();
  const roleIds = managerRoles.map((r) => r._id);

  const query = { company: companyId, role: { $in: roleIds }, isActive: true };
  if (excludeUserId) query._id = { $ne: excludeUserId };

  const count = await User.countDocuments(query);
  const max = company.maxManagers?.total ?? company.maxManagers?.manager1 ?? 2;
  if (count >= max) {
    throw httpError(
      409,
      'MANAGER_LIMIT_REACHED',
      `Max manager users reached for this company (${max})`
    );
  }
}

module.exports = { assertManagerLimitAvailable };

