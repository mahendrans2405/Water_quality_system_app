const mongoose = require('mongoose');

const readingSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    timestamp: { type: Date, required: true, index: true },

    pH: { type: Number, required: true },
    turbidity: { type: Number, required: true },
    dissolvedOxygen: { type: Number, required: true },
    temperature: { type: Number, required: true },

    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: undefined }, // [lng, lat]
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

readingSchema.index({ company: 1, timestamp: -1 });
readingSchema.index({ location: '2dsphere' });

const WaterQualityReading = mongoose.model('WaterQualityReading', readingSchema);

module.exports = { WaterQualityReading };

