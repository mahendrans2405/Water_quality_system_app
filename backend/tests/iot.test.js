const assert = require('assert');
const { Roles } = require('../src/constants/roles');
const { Permissions, DEFAULT_ROLE_PERMISSIONS } = require('../src/constants/permissions');
const { ioTDataService } = require('../src/services/iot');

async function runTests() {
  console.log('=== RUNNING IOT PLATFORM SERVICE TESTS ===\n');

  // Test 1: IoTDataService Field Mapping & Thresholds
  console.log('Test 1: Verify IoTDataService Field Mapping & Thresholds...');
  const mockDevice = {
    _id: 'mock_dev_01',
    deviceId: 'TEST-DEV-01',
    offlineThresholdMinutes: 30,
    fieldMappings: [
      { fieldNumber: 1, parameterName: 'pH', unit: 'pH', minThreshold: 6.5, maxThreshold: 8.5 },
      { fieldNumber: 2, parameterName: 'Turbidity', unit: 'NTU', minThreshold: 0, maxThreshold: 5.0 },
      { fieldNumber: 3, parameterName: 'TDS', unit: 'ppm', minThreshold: 0, maxThreshold: 500 },
    ],
  };

  const rawFeedSafe = {
    entry_id: 101,
    created_at: new Date().toISOString(),
    field1: '7.4',
    field2: '0.8', // Normal target: < 1 NTU
    field3: '220', // Normal target: < 600 ppm
  };

  const telemetrySafe = ioTDataService.mapFeedToTelemetry(mockDevice, rawFeedSafe);
  assert.strictEqual(telemetrySafe.parameters.pH.value, 7.4);
  assert.strictEqual(telemetrySafe.parameters.Turbidity.value, 0.8);
  assert.strictEqual(telemetrySafe.parameters.TDS.value, 220);
  assert.strictEqual(telemetrySafe.isWarning, false, 'Safe reading should not trigger warnings');
  assert.strictEqual(telemetrySafe.severity, 'NORMAL');
  assert.strictEqual(telemetrySafe.status, 'Safe');
  assert.strictEqual(telemetrySafe.alerts.length, 0);

  const rawFeedAlert = {
    entry_id: 102,
    created_at: new Date().toISOString(),
    field1: '9.2', // Warning level (<6.0 or >9.0)
    field2: '6.5', // Warning level (5-10 NTU)
    field3: '220',
  };

  const telemetryAlert = ioTDataService.mapFeedToTelemetry(mockDevice, rawFeedAlert);
  assert.strictEqual(telemetryAlert.isWarning, true, 'Out of bounds values should trigger warning');
  assert.strictEqual(telemetryAlert.severity, 'WARNING');
  assert.strictEqual(telemetryAlert.status, 'Warning');
  assert.strictEqual(telemetryAlert.alerts.length, 2);
  console.log('✓ IoTDataService field mapping and tiered WHO threshold alerts verified.\n');

  // Test 2: Device Status Calculation
  console.log('Test 2: Verify Dynamic Device Status Calculation...');
  const now = new Date();
  const onlineStatus = ioTDataService.calculateDeviceStatus(now, 30, false);
  assert.strictEqual(onlineStatus, 'Online');

  const warningStatus = ioTDataService.calculateDeviceStatus(now, 30, true);
  assert.strictEqual(warningStatus, 'Warning');

  const fortyMinutesAgo = new Date(Date.now() - 40 * 60 * 1000);
  const offlineStatus = ioTDataService.calculateDeviceStatus(fortyMinutesAgo, 30, false);
  assert.strictEqual(offlineStatus, 'Offline');

  const dangerStatus = ioTDataService.calculateDeviceStatus(now, 30, false, 'DANGER');
  assert.strictEqual(dangerStatus, 'Danger');

  const noDataStatus = ioTDataService.calculateDeviceStatus(null, 30, false);
  assert.strictEqual(noDataStatus, 'No Recent Data');
  console.log('✓ Device status calculation (Online, Warning, Danger, Offline, No Data) verified.\n');

  // Test 2b: WHO 4-Tier Water Alert Parameter Engine
  console.log('Test 2b: Verify WHO 4-Tier Water Alert Parameter Engine...');
  const { evaluateWaterParameter } = require('../src/services/iot/waterAlerts');

  // pH checks
  assert.strictEqual(evaluateWaterParameter('pH', 7.2).severity, 'NORMAL');
  assert.strictEqual(evaluateWaterParameter('pH', 8.6).severity, 'ALERT');
  assert.strictEqual(evaluateWaterParameter('pH', 9.2).severity, 'WARNING');
  assert.strictEqual(evaluateWaterParameter('pH', 9.8).severity, 'DANGER');
  assert.strictEqual(evaluateWaterParameter('pH', 5.2).severity, 'DANGER');

  // Turbidity checks
  assert.strictEqual(evaluateWaterParameter('Turbidity', 0.8).severity, 'NORMAL');
  assert.strictEqual(evaluateWaterParameter('Turbidity', 3.0).severity, 'ALERT');
  assert.strictEqual(evaluateWaterParameter('Turbidity', 8.0).severity, 'WARNING');
  assert.strictEqual(evaluateWaterParameter('Turbidity', 15.0).severity, 'DANGER');

  // TDS checks
  assert.strictEqual(evaluateWaterParameter('TDS', 450).severity, 'NORMAL');
  assert.strictEqual(evaluateWaterParameter('TDS', 750).severity, 'ALERT');
  assert.strictEqual(evaluateWaterParameter('TDS', 1250).severity, 'WARNING');
  assert.strictEqual(evaluateWaterParameter('TDS', 1800).severity, 'DANGER');
  console.log('✓ WHO 4-tier water alert engine (Normal, Alert, Warning, Danger) fully verified.\n');

  // Test 3: In-Memory Cache and Request Deduplication
  console.log('Test 3: Verify Caching & Request Coalescing...');
  let apiCallCount = 0;
  class MockProvider {
    async getLatestFeed() {
      apiCallCount++;
      await new Promise((r) => setTimeout(r, 50));
      return { entry_id: 1, created_at: new Date().toISOString(), field1: '7.1' };
    }
    async getFeeds() {
      apiCallCount++;
      return { feeds: [] };
    }
  }

  const testIoTService = new (require('../src/services/iot').IoTDataService)({
    provider: new MockProvider(),
    liveCacheTtlMs: 5000,
  });

  const testDevice = {
    _id: '507f1f77bcf86cd799439011',
    channelId: 'mock_channel_123',
    readKey: 'MOCK_KEY',
    fieldMappings: [{ fieldNumber: 1, parameterName: 'pH', unit: 'pH' }],
  };

  // Launch 3 simultaneous requests
  const [res1, res2, res3] = await Promise.all([
    testIoTService.getLiveTelemetry(testDevice),
    testIoTService.getLiveTelemetry(testDevice),
    testIoTService.getLiveTelemetry(testDevice),
  ]);

  assert.strictEqual(apiCallCount, 1, 'Simultaneous requests should coalesce into a SINGLE provider call');
  assert.strictEqual(res1.telemetry.parameters.pH.value, 7.1);
  assert.strictEqual(res2.telemetry.parameters.pH.value, 7.1);

  // Fourth request within TTL should hit cache
  const res4 = await testIoTService.getLiveTelemetry(testDevice);
  assert.strictEqual(apiCallCount, 1, 'Subsequent request within TTL must hit cache without API call');
  console.log('✓ Caching and request coalescing verified (Prevents ThingSpeak rate limit exhaustion).\n');

  console.log('=== ALL IOT SERVICE TESTS PASSED SUCCESSFULLY! ===');
}

runTests().catch((err) => {
  console.error('Test failure:', err);
  process.exit(1);
});
