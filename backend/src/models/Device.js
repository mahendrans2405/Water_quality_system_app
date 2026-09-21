const mongoose = require('mongoose');

const fieldMappingSchema = new mongoose.Schema(
  {
    fieldNumber: { type: Number, required: true, min: 1, max: 8 }, // ThingSpeak supports field1 through field8
    parameterName: { type: String, required: true, trim: true }, // e.g. 'pH', 'TDS', 'Turbidity', 'Temperature'
    unit: { type: String, default: '', trim: true }, // e.g. 'pH', 'ppm', 'NTU', '°C'
    dataType: { type: String, enum: ['number', 'string', 'boolean'], default: 'number' },
    displayFormat: { type: String, default: '0.00' },
    minThreshold: { type: Number, default: null }, // e.g. 6.5 for pH
    maxThreshold: { type: Number, default: null }, // e.g. 8.5 for pH
  },
  { _id: false }
);

const deviceSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    deviceId: { type: String, required: true, trim: true },
    name: { type: String, default: '', trim: true },
    deviceType: { type: String, default: 'Water Quality Monitor', trim: true },
    channelId: { type: String, required: true, trim: true },
    readKey: { type: String, required: true, trim: true }, // ThingSpeak Read API Key (never exposed to frontend)
    writeKey: { type: String, default: '', trim: true }, // ThingSpeak Write API Key (optional, server-side only)
    assignedManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    branch: { type: String, default: '', trim: true, index: true },
    unit: { type: String, default: '', trim: true, index: true },
    location: { type: String, default: '', trim: true },
    installationDate: { type: Date, default: null },
    offlineThresholdMinutes: { type: Number, default: 30, min: 1 }, // Minutes before marked Offline
    fieldMappings: {
      type: [fieldMappingSchema],
      default: () => [
        { fieldNumber: 1, parameterName: 'pH', unit: 'pH', dataType: 'number', minThreshold: 6.5, maxThreshold: 8.5 },
        { fieldNumber: 2, parameterName: 'Turbidity', unit: 'NTU', dataType: 'number', minThreshold: 0, maxThreshold: 5.0 },
        { fieldNumber: 3, parameterName: 'TDS', unit: 'ppm', dataType: 'number', minThreshold: 0, maxThreshold: 500 },
        { fieldNumber: 4, parameterName: 'Hardware ID', unit: '', dataType: 'string' },
      ],
    },
    lastDataReceived: { type: Date, default: null },
    status: {
      type: String,
      enum: ['Online', 'Offline', 'Warning', 'No Recent Data'],
      default: 'No Recent Data',
    },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

deviceSchema.index({ company: 1, deviceId: 1 }, { unique: true });
deviceSchema.index({ company: 1, channelId: 1 }, { unique: true });
deviceSchema.index({ company: 1, assignedManager: 1 });
deviceSchema.index({ company: 1, branch: 1 });
deviceSchema.index({ company: 1, branch: 1, unit: 1 });

const Device = mongoose.model('Device', deviceSchema);

module.exports = { Device };
