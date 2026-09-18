const https = require('https');
const http = require('http');

/**
 * Helper to fetch JSON from HTTP/HTTPS with TLS error resilience.
 */
function httpGetJson(urlStr) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(urlStr);
    const client = urlObj.protocol === 'http:' ? http : https;
    const options = {
      rejectUnauthorized: false,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'WaterQualityIoTPlatform/1.0',
      },
    };

    const req = client.get(urlStr, options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 429) {
          const err = new Error('ThingSpeak rate limit exceeded (HTTP 429). Please wait 15 seconds.');
          err.code = 'RATE_LIMITED';
          err.statusCode = 429;
          return reject(err);
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const err = new Error(`ThingSpeak request failed with HTTP ${res.statusCode}: ${res.statusMessage}`);
          err.statusCode = res.statusCode;
          return reject(err);
        }
        try {
          const json = JSON.parse(body);
          resolve(json);
        } catch (parseErr) {
          reject(new Error(`Failed to parse ThingSpeak JSON response: ${parseErr.message}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.setTimeout(20000, () => {
      req.destroy(new Error('ThingSpeak request timed out after 20s'));
    });
  });
}

/**
 * ThingSpeak Provider for IoTDataService.
 * Handles HTTP requests to ThingSpeak API using server-side keys.
 * Implements rate-limit awareness and error resilience.
 */
class ThingSpeakProvider {
  constructor() {
    this.name = 'ThingSpeak';
    this.defaultBaseUrl = 'https://api.thingspeak.com';
    // Track channel cooldowns to avoid hammering when 429 is encountered
    this.channelCooldowns = new Map(); // channelId -> cooldownExpiryTimestamp
  }

  /**
   * Fetch recent feeds for a channel.
   * @param {object} params
   * @param {string} params.channelId
   * @param {string} params.readKey
   * @param {number} [params.results=100]
   * @param {string} [params.start] ISO date string
   * @param {string} [params.end] ISO date string
   * @param {string} [params.baseUrl]
   * @returns {Promise<{ feeds: any[], channel: any }>}
   */
  async getFeeds({ channelId, readKey, results = 100, start, end, baseUrl }) {
    if (!channelId || !readKey) {
      throw new Error('channelId and readKey are required for ThingSpeak feed request');
    }

    // Check if channel is under rate-limit cooldown
    const cooldownExpiry = this.channelCooldowns.get(channelId);
    if (cooldownExpiry && Date.now() < cooldownExpiry) {
      const waitSeconds = Math.ceil((cooldownExpiry - Date.now()) / 1000);
      throw new Error(`ThingSpeak rate limit active for channel ${channelId}. Cooldown remaining: ${waitSeconds}s`);
    }

    const host = (baseUrl || this.defaultBaseUrl).replace(/\/$/, '');
    const url = new URL(`${host}/channels/${encodeURIComponent(channelId)}/feeds.json`);
    url.searchParams.set('api_key', readKey);
    url.searchParams.set('results', String(Math.min(results, 500))); // Constrain results for free plan

    if (start) {
      url.searchParams.set('start', new Date(start).toISOString());
    }
    if (end) {
      url.searchParams.set('end', new Date(end).toISOString());
    }

    let data;
    try {
      data = await httpGetJson(url.toString());
    } catch (err) {
      if (err.code === 'RATE_LIMITED' || err.statusCode === 429) {
        this.channelCooldowns.set(channelId, Date.now() + 15000);
      }
      throw err;
    }

    return {
      channel: data?.channel || {},
      feeds: Array.isArray(data?.feeds) ? data.feeds : [],
    };
  }

  /**
   * Fetch only the latest single reading for a channel.
   * @param {object} params
   * @returns {Promise<any|null>}
   */
  async getLatestFeed(params) {
    const result = await this.getFeeds({ ...params, results: 2 });
    const feeds = result.feeds;
    return feeds.length > 0 ? feeds[feeds.length - 1] : null;
  }
}

module.exports = { ThingSpeakProvider };
