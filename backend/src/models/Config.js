const mongoose = require('mongoose');

const configSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true, unique: true },
    pHMin: { type: Number, default: 6.5 },
    pHMax: { type: Number, default: 8.5 },
    turbidityMax: { type: Number, default: 5 },
    dissolvedOxygenMin: { type: Number, default: 5 },
    temperatureMax: { type: Number, default: 35 },
    thingspeak: {
      enabled: { type: Boolean, default: false },
      channelId: { type: String, default: '' },
      readKey: { type: String, default: '' },
      writeKey: { type: String, default: '' },
      apiBaseUrl: { type: String, default: 'https://api.thingspeak.com' },
    },
  },
  { timestamps: true }
);

const Config = mongoose.model('Config', configSchema);

module.exports = { Config };

