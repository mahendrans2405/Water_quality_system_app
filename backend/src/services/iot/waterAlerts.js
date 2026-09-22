/**
 * Water Quality Alert Evaluation Module
 * Implements WHO / EPA tiered alert thresholds for pH, TDS, and Turbidity.
 *
 * Tiers:
 * - Normal: Target acceptable safe range
 * - Alert: Moderate deviation requiring monitoring
 * - Warning: Significant deviation requiring investigation
 * - Danger: Severe critical deviation requiring immediate action
 */

function evaluateWaterParameter(parameterName, value, unit = '') {
  if (value === null || value === undefined || typeof value !== 'number' || Number.isNaN(value)) {
    return {
      severity: 'NORMAL',
      alertMessage: null,
      isAlert: false,
      targetDesc: 'No Data',
    };
  }

  const pName = String(parameterName).trim().toLowerCase();

  // 1. pH: Normal: 6.5–8.5 | Alert: <6.5 or >8.5 | Warning: <6.0 or >9.0 | Danger: <5.5 or >9.5
  if (pName.includes('ph')) {
    if (value < 5.5 || value > 9.5) {
      return {
        severity: 'DANGER',
        alertMessage: `pH at Critical Danger level: ${value} (Danger: <5.5 or >9.5)`,
        isAlert: true,
        targetDesc: 'Normal: 6.5–8.5 pH',
      };
    }
    if (value < 6.0 || value > 9.0) {
      return {
        severity: 'WARNING',
        alertMessage: `pH at Warning level: ${value} (Warning: <6.0 or >9.0)`,
        isAlert: true,
        targetDesc: 'Normal: 6.5–8.5 pH',
      };
    }
    if (value < 6.5 || value > 8.5) {
      return {
        severity: 'ALERT',
        alertMessage: `pH at Alert level: ${value} (Alert: <6.5 or >8.5)`,
        isAlert: true,
        targetDesc: 'Normal: 6.5–8.5 pH',
      };
    }
    return {
      severity: 'NORMAL',
      alertMessage: null,
      isAlert: false,
      targetDesc: 'Normal: 6.5–8.5 pH',
    };
  }

  // 2. TDS: Normal: <600 | Alert: 600–1000 | Warning: 1000–1500 | Danger: >1500 mg/L (ppm)
  if (pName.includes('tds')) {
    if (value > 1500) {
      return {
        severity: 'DANGER',
        alertMessage: `TDS at Critical Danger level: ${value} ppm (Danger: >1500 ppm)`,
        isAlert: true,
        targetDesc: 'Normal: <600 ppm',
      };
    }
    if (value >= 1000) {
      return {
        severity: 'WARNING',
        alertMessage: `TDS at Warning level: ${value} ppm (Warning: 1000–1500 ppm)`,
        isAlert: true,
        targetDesc: 'Normal: <600 ppm',
      };
    }
    if (value >= 600) {
      return {
        severity: 'ALERT',
        alertMessage: `TDS at Alert level: ${value} ppm (Alert: 600–1000 ppm)`,
        isAlert: true,
        targetDesc: 'Normal: <600 ppm',
      };
    }
    return {
      severity: 'NORMAL',
      alertMessage: null,
      isAlert: false,
      targetDesc: 'Normal: <600 ppm',
    };
  }

  // 3. Turbidity: Normal: <1 | Alert: 1–5 | Warning: 5–10 | Danger: >10 NTU
  if (pName.includes('turbid')) {
    if (value > 10) {
      return {
        severity: 'DANGER',
        alertMessage: `Turbidity at Critical Danger level: ${value} NTU (Danger: >10 NTU)`,
        isAlert: true,
        targetDesc: 'Normal: <1 NTU',
      };
    }
    if (value >= 5) {
      return {
        severity: 'WARNING',
        alertMessage: `Turbidity at Warning level: ${value} NTU (Warning: 5–10 NTU)`,
        isAlert: true,
        targetDesc: 'Normal: <1 NTU',
      };
    }
    if (value >= 1) {
      return {
        severity: 'ALERT',
        alertMessage: `Turbidity at Alert level: ${value} NTU (Alert: 1–5 NTU)`,
        isAlert: true,
        targetDesc: 'Normal: <1 NTU',
      };
    }
    return {
      severity: 'NORMAL',
      alertMessage: null,
      isAlert: false,
      targetDesc: 'Normal: <1 NTU',
    };
  }

  // Fallback for custom configured thresholds
  return {
    severity: 'NORMAL',
    alertMessage: null,
    isAlert: false,
    targetDesc: 'Normal',
  };
}

function evaluateReadingSeverity(parameters = {}) {
  let highest = 'NORMAL';
  const severityRank = { NORMAL: 0, ALERT: 1, WARNING: 2, DANGER: 3 };

  for (const param of Object.values(parameters)) {
    const sev = param.severity || 'NORMAL';
    if ((severityRank[sev] || 0) > (severityRank[highest] || 0)) {
      highest = sev;
    }
  }

  const statusMap = {
    NORMAL: 'Safe',
    ALERT: 'Alert',
    WARNING: 'Warning',
    DANGER: 'Danger',
  };

  return {
    severity: highest,
    status: statusMap[highest] || 'Safe',
    isSafe: highest === 'NORMAL',
  };
}

module.exports = {
  evaluateWaterParameter,
  evaluateReadingSeverity,
};
