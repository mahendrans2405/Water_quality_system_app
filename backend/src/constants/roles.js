const Roles = Object.freeze({
  SuperAdmin: 'SuperAdmin',
  Company: 'Company',
  Manager: 'Manager',
  // Backwards compatibility aliases
  Manager1: 'Manager1',
  Manager2: 'Manager2',
});

const ALL_ROLES = Object.freeze(Object.values(Roles));
const CANONICAL_ROLES = Object.freeze([Roles.SuperAdmin, Roles.Company, Roles.Manager]);

module.exports = { Roles, ALL_ROLES, CANONICAL_ROLES };
