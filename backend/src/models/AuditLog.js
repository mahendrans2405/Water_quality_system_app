const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    userEmail: { type: String, default: '' },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: false },
    action: { type: String, required: true, index: true }, // e.g., 'DATA_EXPORT', 'DEVICE_CREATE', 'DEVICE_DELETE'
    resource: { type: String, required: true }, // e.g., 'device_data', 'device', 'user', 'company'
    resourceId: { type: String, default: '' },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: '' },
    status: { type: String, enum: ['SUCCESS', 'FAILURE'], default: 'SUCCESS' },
  },
  { timestamps: true }
);

auditLogSchema.index({ company: 1, createdAt: -1 });
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = { AuditLog };
