const mongoose = require('mongoose');

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, default: '' },
    maxManagers: {
      manager1: { type: Number, default: 2, min: 0 },
      manager2: { type: Number, default: 2, min: 0 },
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

companySchema.index({ name: 1 }, { unique: true });

const Company = mongoose.model('Company', companySchema);

module.exports = { Company };

