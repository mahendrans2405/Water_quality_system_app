const { ThingSpeakProvider } = require('./ThingSpeakProvider');
const { Device } = require('../../models');
const { evaluateWaterParameter, evaluateReadingSeverity } = require('./waterAlerts');

/**
 * IoTDataService - Core Abstraction Layer for IoT Telemetry.
 * Decouples frontend and business logic from specific IoT providers (ThingSpeak, MQTT, AWS IoT, etc.).
 * Includes in-memory caching and in-flight request coalescing to optimize ThingSpeak Free Plan usage.
 */
class IoTDataService {
  /**
   * @param {object} [options]
   * @param {object} [options.provider] - Pluggable provider instance
   * @param {number} [options.liveCacheTtlMs=30000] - Cache TTL for live feeds (30s)
   * @param {number} [options.historyCacheTtlMs=60000] - Cache TTL for historical queries (60s)
   */
  constructor({ provider, liveCacheTtlMs = 30000, historyCacheTtlMs = 60000 } = {}) {
    this.provider = provider || new ThingSpeakProvider();
    this.liveCacheTtlMs = liveCacheTtlMs;
    this.historyCacheTtlMs = historyCacheTtlMs;

    // In-memory cache: Map<cacheKey, { data: any, expiresAt: number, lastSuccessfulData: any }>
    this.cache = new Map();

    // In-flight request deduplication map: Map<cacheKey, Promise<any>>
    this.inFlightRequests = new Map();
  }

  /**
   * Replace or upgrade the underlying IoT provider.
   * @param {object} newProvider
   */
  setProvider(newProvider) {
    this.provider = newProvider;
  }

  /**
   * Map raw provider feed entry to standardized telemetry object based on device fieldMappings.
   * Evaluates WHO/EPA tiered alert thresholds for pH, TDS, and Turbidity (Normal, Alert, Warning, Danger).
   * @param {object} device
   * @param {object} rawFeed
   * @returns {object} Standardized telemetry record
   */
  mapFeedToTelemetry(device, rawFeed) {
    if (!rawFeed) return null;

    const mappings = Array.isArray(device.fieldMappings) && device.fieldMappings.length > 0
      ? device.fieldMappings
      : [
          { fieldNumber: 1, parameterName: 'pH', unit: 'pH', minThreshold: 6.5, maxThreshold: 8.5 },
          { fieldNumber: 2, parameterName: 'Turbidity', unit: 'NTU', minThreshold: 0, maxThreshold: 5.0 },
          { fieldNumber: 3, parameterName: 'TDS', unit: 'ppm', minThreshold: 0, maxThreshold: 500 },
        ];

    const parameters = {};
    const alerts = [];

    for (const mapping of mappings) {
      const fieldKey = `field${mapping.fieldNumber}`;
      const rawValue = rawFeed[fieldKey];

      let value = null;
      if (rawValue !== null && rawValue !== undefined && rawValue !== '') {
        value = mapping.dataType === 'string' ? String(rawValue).trim() : Number(rawValue);
        if (Number.isNaN(value)) value = String(rawValue);
      }

      // Tiered Alert Evaluation (Normal, Alert, Warning, Danger)
      const evaluation = evaluateWaterParameter(mapping.parameterName, value, mapping.unit);

      parameters[mapping.parameterName] = {
        fieldNumber: mapping.fieldNumber,
        value,
        unit: mapping.unit || '',
        minThreshold: mapping.minThreshold,
        maxThreshold: mapping.maxThreshold,
        severity: evaluation.severity,
        targetDesc: evaluation.targetDesc,
      };

      if (evaluation.isAlert && evaluation.alertMessage) {
        alerts.push(evaluation.alertMessage);
      } else if (typeof value === 'number') {
        // Fallback for custom user-configured thresholds if not standard water parameters
        if (mapping.minThreshold !== null && mapping.minThreshold !== undefined && value < mapping.minThreshold) {
          alerts.push(`${mapping.parameterName} is below minimum threshold (${value} < ${mapping.minThreshold} ${mapping.unit || ''})`);
        }
        if (mapping.maxThreshold !== null && mapping.maxThreshold !== undefined && value > mapping.maxThreshold) {
          alerts.push(`${mapping.parameterName} exceeds maximum threshold (${value} > ${mapping.maxThreshold} ${mapping.unit || ''})`);
        }
      }
    }

    const timestamp = rawFeed.created_at ? new Date(rawFeed.created_at) : new Date();
    const readingSeverity = evaluateReadingSeverity(parameters);

    return {
      id: rawFeed.entry_id ? String(rawFeed.entry_id) : String(timestamp.getTime()),
      timestamp: timestamp.toISOString(),
      parameters,
      alerts,
      severity: readingSeverity.severity,
      status: readingSeverity.status,
      isSafe: readingSeverity.isSafe,
      isWarning: alerts.length > 0,
      raw: rawFeed,
    };
  }

  /**
   * Determine device status based on last timestamp received, alerts, and severity.
   * @param {Date|string|null} lastTimestamp
   * @param {number} offlineThresholdMinutes
   * @param {boolean} hasAlerts
   * @param {'NORMAL' | 'ALERT' | 'WARNING' | 'DANGER'} [maxSeverity='NORMAL']
   * @returns {'Online' | 'Offline' | 'Warning' | 'Danger' | 'No Recent Data'}
   */
  calculateDeviceStatus(lastTimestamp, offlineThresholdMinutes = 30, hasAlerts = false, maxSeverity = 'NORMAL') {
    if (!lastTimestamp) return 'No Recent Data';

    const lastTime = new Date(lastTimestamp).getTime();
    if (Number.isNaN(lastTime)) return 'No Recent Data';

    const diffMinutes = (Date.now() - lastTime) / (1000 * 60);

    if (diffMinutes > offlineThresholdMinutes) {
      return 'Offline';
    }

    if (maxSeverity === 'DANGER') {
      return 'Danger';
    }

    if (hasAlerts || maxSeverity === 'WARNING' || maxSeverity === 'ALERT') {
      return 'Warning';
    }

    return 'Online';
  }

  /**
   * Fetch latest live telemetry for a device with caching and request coalescing.
   * @param {object} device - Mongoose Device document or object
   * @returns {Promise<{ telemetry: object|null, status: string, isStale: boolean }>}
   */
  async getLiveTelemetry(device) {
    if (!device?.channelId || !device?.readKey) {
      return {
        telemetry: null,
        status: device?.status || 'No Recent Data',
        isStale: false,
      };
    }

    const cacheKey = `live_${device.channelId}`;
    const cached = this.cache.get(cacheKey);

    // Return fresh cached data if within TTL
    if (cached && Date.now() < cached.expiresAt) {
      return {
        telemetry: cached.data,
        status: this.calculateDeviceStatus(
          cached.data?.timestamp,
          device.offlineThresholdMinutes,
          cached.data?.isWarning
        ),
        isStale: false,
      };
    }

    // Coalesce duplicate in-flight requests
    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey);
    }

    const fetchPromise = (async () => {
      try {
        const rawFeed = await this.provider.getLatestFeed({
          channelId: device.channelId,
          readKey: device.readKey,
        });

        const telemetry = this.mapFeedToTelemetry(device, rawFeed);
        const status = this.calculateDeviceStatus(
          telemetry?.timestamp,
          device.offlineThresholdMinutes,
          telemetry?.isWarning,
          telemetry?.severity
        );

        // Update cache
        this.cache.set(cacheKey, {
          data: telemetry,
          expiresAt: Date.now() + this.liveCacheTtlMs,
          lastSuccessfulData: telemetry,
        });

        // Asynchronously update device in DB if status or lastDataReceived changed
        if (telemetry?.timestamp) {
          Device.updateOne(
            { _id: device._id },
            {
              $set: {
                lastDataReceived: new Date(telemetry.timestamp),
                status,
              },
            }
          ).catch((e) => console.warn('[IoTDataService] Device update warning:', e?.message));
        }

        return { telemetry, status, isStale: false };
      } catch (err) {
        console.warn(`[IoTDataService] Error fetching live telemetry for device ${device.deviceId}:`, err.message);

        // Graceful degradation: return last known cached reading if available
        if (cached?.lastSuccessfulData) {
          const status = this.calculateDeviceStatus(
            cached.lastSuccessfulData?.timestamp,
            device.offlineThresholdMinutes,
            cached.lastSuccessfulData?.isWarning,
            cached.lastSuccessfulData?.severity
          );
          return {
            telemetry: cached.lastSuccessfulData,
            status,
            isStale: true,
            warning: err.message,
          };
        }

        return {
          telemetry: null,
          status: device.status || 'No Recent Data',
          isStale: true,
          error: err.message,
        };
      } finally {
        this.inFlightRequests.delete(cacheKey);
      }
    })();

    this.inFlightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Fetch historical time-series telemetry for a device.
   * @param {object} device
   * @param {object} [options]
   * @param {number} [options.results=100]
   * @param {string} [options.start]
   * @param {string} [options.end]
   * @returns {Promise<{ items: object[], total: number, isStale: boolean }>}
   */
  async getTelemetryHistory(device, { results = 100, start, end } = {}) {
    if (!device?.channelId || !device?.readKey) {
      return { items: [], total: 0, isStale: false };
    }

    const cacheKey = `history_${device.channelId}_${results}_${start || ''}_${end || ''}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      return { items: cached.data, total: cached.data.length, isStale: false };
    }

    if (this.inFlightRequests.has(cacheKey)) {
      return this.inFlightRequests.get(cacheKey);
    }

    const fetchPromise = (async () => {
      try {
        const { feeds } = await this.provider.getFeeds({
          channelId: device.channelId,
          readKey: device.readKey,
          results,
          start,
          end,
        });

        const items = feeds
          .map((f) => this.mapFeedToTelemetry(device, f))
          .filter(Boolean);

        this.cache.set(cacheKey, {
          data: items,
          expiresAt: Date.now() + this.historyCacheTtlMs,
          lastSuccessfulData: items,
        });

        return { items, total: items.length, isStale: false };
      } catch (err) {
        console.warn(`[IoTDataService] Error fetching history for device ${device.deviceId}:`, err.message);

        if (cached?.lastSuccessfulData) {
          return { items: cached.lastSuccessfulData, total: cached.lastSuccessfulData.length, isStale: true };
        }

        throw err;
      } finally {
        this.inFlightRequests.delete(cacheKey);
      }
    })();

    this.inFlightRequests.set(cacheKey, fetchPromise);
    return fetchPromise;
  }

  /**
   * Invalidate cache for a specific channel or device.
   * @param {string} channelId
   */
  invalidateCache(channelId) {
    for (const key of this.cache.keys()) {
      if (key.includes(channelId)) {
        this.cache.delete(key);
      }
    }
  }
}

// Singleton instance
const ioTDataService = new IoTDataService();

module.exports = { IoTDataService, ioTDataService };
