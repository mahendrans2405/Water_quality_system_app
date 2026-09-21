const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
  },
  { _id: true }
);

const branchSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    units: { type: [unitSchema], default: () => [] },
  },
  { _id: true }
);

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    address: { type: String, default: '' },
    branches: { type: [branchSchema], default: () => [] },
    maxManagers: {
      total: { type: Number, default: 2, min: 0 },
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

