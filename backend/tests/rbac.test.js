const assert = require('assert');
const { signAccessToken } = require('../src/utils/jwt');
const { Roles } = require('../src/constants/roles');
const { Permissions } = require('../src/constants/permissions');
const { requirePermission } = require('../src/middleware/auth');

async function runRbacMiddlewareTests() {
  console.log('=== RUNNING RBAC MIDDLEWARE & PERMISSION VERIFICATION ===\n');

  // Test 1: Manager attempting to download device data
  console.log('Test 1: Verify Manager is rejected from download/export...');
  const managerUser = {
    id: 'mgr_001',
    role: Roles.Manager,
    companyId: 'company_001',
    permissions: [
      Permissions.COMPANY_VIEW,
      Permissions.DEVICES_VIEW,
      Permissions.DEVICE_DATA_VIEW,
    ],
  };

  let rejected = false;
  let rejectionCode = null;
  const mockReq = { user: managerUser };
  const mockRes = {
    status: (code) => {
      rejectionCode = code;
      return {
        json: (data) => {
          rejected = true;
        },
      };
    },
  };
  let nextCalled = false;
  const next = () => { nextCalled = true; };

  const downloadGuard = requirePermission(Permissions.DEVICE_DATA_DOWNLOAD);
  downloadGuard(mockReq, mockRes, next);

  assert.strictEqual(rejected, true, 'Manager request must be rejected');
  assert.strictEqual(rejectionCode, 403, 'Manager must receive HTTP 403 Forbidden');
  assert.strictEqual(nextCalled, false, 'Next middleware must not be called');
  console.log('✓ Manager download rejected with 403 Forbidden as strictly required.\n');

  // Test 2: Company Admin attempting download
  console.log('Test 2: Verify Company Admin is granted download access...');
  const companyUser = {
    id: 'comp_001',
    role: Roles.Company,
    companyId: 'company_001',
    permissions: [
      Permissions.COMPANY_VIEW,
      Permissions.DEVICES_VIEW,
      Permissions.DEVICE_DATA_VIEW,
      Permissions.DEVICE_DATA_DOWNLOAD,
      Permissions.DEVICE_DATA_EXPORT,
    ],
  };

  rejected = false;
  nextCalled = false;
  const mockReqCompany = { user: companyUser };
  downloadGuard(mockReqCompany, mockRes, next);

  assert.strictEqual(rejected, false, 'Company Admin request must not be rejected');
  assert.strictEqual(nextCalled, true, 'Next middleware must be called for Company Admin');
  console.log('✓ Company Admin granted download access.\n');

  // Test 3: SuperAdmin download access
  console.log('Test 3: Verify SuperAdmin is granted download access...');
  const superAdminUser = {
    id: 'super_001',
    role: Roles.SuperAdmin,
    companyId: null,
    permissions: [], // SuperAdmin has system bypass
  };

  rejected = false;
  nextCalled = false;
  const mockReqSuper = { user: superAdminUser };
  downloadGuard(mockReqSuper, mockRes, next);

  assert.strictEqual(rejected, false, 'SuperAdmin request must not be rejected');
  assert.strictEqual(nextCalled, true, 'Next middleware must be called for SuperAdmin');
  console.log('✓ SuperAdmin granted download access.\n');

  console.log('=== ALL RBAC PERMISSION TESTS PASSED! ===');
}

runRbacMiddlewareTests().catch((err) => {
  console.error('RBAC Test failure:', err);
  process.exit(1);
});
