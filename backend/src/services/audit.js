const { AuditLog } = require('../models');

/**
 * Record an audit log entry for compliance and tracking.
 * @param {object} params
 * @param {string|ObjectId} [params.userId]
 * @param {string} [params.userEmail]
 * @param {string|ObjectId} [params.companyId]
 * @param {string} params.action - e.g. 'DATA_DOWNLOAD', 'DATA_EXPORT', 'DEVICE_CREATE', 'DEVICE_DELETE'
 * @param {string} params.resource - e.g. 'device_data', 'device', 'company', 'user'
 * @param {string} [params.resourceId]
 * @param {object} [params.details]
 * @param {string} [params.ipAddress]
 * @param {string} [params.status] - 'SUCCESS' | 'FAILURE'
 */
async function logAudit({
  userId = null,
  userEmail = '',
  companyId = null,
  action,
  resource,
  resourceId = '',
  details = {},
  ipAddress = '',
  status = 'SUCCESS',
}) {
  try {
    await AuditLog.create({
      user: userId || undefined,
      userEmail: userEmail || '',
      company: companyId || undefined,
      action,
      resource,
      resourceId: String(resourceId || ''),
      details,
      ipAddress: ipAddress || '',
      status,
    });
  } catch (err) {
    // Audit logging should not crash the main request flow, but log warnings
    console.warn('[AuditLog Warning] Failed to create audit log:', err?.message || err);
  }
}

module.exports = { logAudit };
