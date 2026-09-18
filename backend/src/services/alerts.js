function evaluateReadingAgainstConfig(reading, cfg) {
  const alerts = [];
  if (reading.pH < cfg.pHMin || reading.pH > cfg.pHMax) alerts.push('PH_OUT_OF_RANGE');
  if (reading.turbidity > cfg.turbidityMax) alerts.push('TURBIDITY_HIGH');
  if (reading.dissolvedOxygen < cfg.dissolvedOxygenMin) alerts.push('DISSOLVED_OXYGEN_LOW');
  if (reading.temperature > cfg.temperatureMax) alerts.push('TEMPERATURE_HIGH');
  return { alerts, isSafe: alerts.length === 0 };
}

module.exports = { evaluateReadingAgainstConfig };

