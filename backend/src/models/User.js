const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
    branch: { type: String, default: '', trim: true },
    unit: { type: String, default: '', trim: true },
    assignedDevices: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Device' }],
    isActive: { type: Boolean, default: true },

    refreshTokenHash: { type: String },
    refreshTokenExpiresAt: { type: Date },
  },
  { timestamps: true }
);

userSchema.index({ company: 1, role: 1 });

const User = mongoose.model('User', userSchema);

module.exports = { User };

