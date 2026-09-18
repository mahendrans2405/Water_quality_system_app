const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');

const { Roles } = require('../constants/roles');
const { requireAuth, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { WaterQualityReading, Config } = require('../models');
const { httpError } = require('../utils/httpError');
const { evaluateReadingAgainstConfig } = require('../services/alerts');

const waterRouter = express.Router();

waterRouter.use(requireAuth);

const submitSchema = z.object({
  body: z.object({
    timestamp: z.string().datetime().optional(),
    pH: z.number(),
    turbidity: z.number(),
    dissolvedOxygen: z.number(),
    temperature: z.number(),
    location: z
      .object({
        lng: z.number(),
        lat: z.number(),
      })
      .optional(),
  }),
});

waterRouter.post(
  '/reading',
  authorize(Roles.Company, Roles.Manager1, Roles.Manager2),
  validate(submitSchema),
  async (req, res, next) => {
    try {
      const { timestamp, pH, turbidity, dissolvedOxygen, temperature, location } = req.validated.body;
      const companyId = req.user.companyId;
      if (!companyId) throw httpError(400, 'COMPANY_REQUIRED', 'Company required');

      const doc = await WaterQualityReading.create({
        company: companyId,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        pH,
        turbidity,
        dissolvedOxygen,
        temperature,
        location: location
          ? { type: 'Point', coordinates: [location.lng, location.lat] }
          : { type: 'Point', coordinates: undefined },
        createdBy: req.user.id,
      });

      res.status(201).json({ ok: true, data: { id: String(doc._id) } });
    } catch (err) {
      next(err);
    }
  }
);

const listSchema = z.object({
  query: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    companyId: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(500).optional(),
    cursor: z.string().optional(),
  }),
});

waterRouter.get(
  '/readings',
  authorize(Roles.SuperAdmin, Roles.Company, Roles.Manager1, Roles.Manager2),
  validate(listSchema),
  async (req, res, next) => {
    try {
      const { from, to, companyId: requestedCompanyId, limit, cursor } = req.validated.query;

      const companyId =
        req.user.role === Roles.SuperAdmin ? requestedCompanyId || null : req.user.companyId;
      if (!companyId && req.user.role !== Roles.SuperAdmin) {
        throw httpError(400, 'COMPANY_REQUIRED', 'Company required');
      }

      const query = {};
      if (companyId) query.company = companyId;
      if (from || to) {
        query.timestamp = {};
        if (from) query.timestamp.$gte = new Date(from);
        if (to) query.timestamp.$lte = new Date(to);
      }
      if (cursor) query._id = { $lt: cursor };

      const docs = await WaterQualityReading.find(query)
        .sort({ _id: -1 })
        .limit(limit || 100)
        .lean();

      const nextCursor = docs.length ? String(docs[docs.length - 1]._id) : null;

      res.json({ ok: true, data: { items: docs, nextCursor } });
    } catch (err) {
      next(err);
    }
  }
);

const statsSchema = z.object({
  query: z.object({
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    companyId: z.string().optional(),
  }),
});

waterRouter.get(
  '/stats',
  authorize(Roles.SuperAdmin, Roles.Company, Roles.Manager1, Roles.Manager2),
  validate(statsSchema),
  async (req, res, next) => {
    try {
      const { from, to, companyId: requestedCompanyId } = req.validated.query;

      const companyId =
        req.user.role === Roles.SuperAdmin ? requestedCompanyId || null : req.user.companyId;
      if (!companyId && req.user.role !== Roles.SuperAdmin) {
        throw httpError(400, 'COMPANY_REQUIRED', 'Company required');
      }

      const match = {};
      if (companyId) {
        match.company = mongoose.Types.ObjectId.isValid(companyId)
          ? new mongoose.Types.ObjectId(companyId)
          : companyId;
      }
      if (from || to) {
        match.timestamp = {};
        if (from) match.timestamp.$gte = new Date(from);
        if (to) match.timestamp.$lte = new Date(to);
      }

      const [latest] = await WaterQualityReading.find(match).sort({ timestamp: -1 }).limit(1).lean();

      const agg = await WaterQualityReading.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            avgPH: { $avg: '$pH' },
            avgTurbidity: { $avg: '$turbidity' },
            avgDissolvedOxygen: { $avg: '$dissolvedOxygen' },
            avgTemperature: { $avg: '$temperature' },
          },
        },
      ]);

      const cfg = companyId ? await Config.findOne({ company: companyId }).lean() : null;
      const latestEval = latest && cfg ? evaluateReadingAgainstConfig(latest, cfg) : null;

      // Alerts in last 24h (simple: compute by pulling recent readings up to 2000)
      let alerts24h = { total: 0, breakdown: {} };
      if (companyId && cfg) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recent = await WaterQualityReading.find({ company: companyId, timestamp: { $gte: since } })
          .sort({ timestamp: -1 })
          .limit(2000)
          .lean();
        const breakdown = {};
        let total = 0;
        for (const r of recent) {
          const { alerts } = evaluateReadingAgainstConfig(r, cfg);
          if (alerts.length) total += 1;
          for (const a of alerts) breakdown[a] = (breakdown[a] || 0) + 1;
        }
        alerts24h = { total, breakdown };
      }

      res.json({
        ok: true,
        data: {
          range: { from: from || null, to: to || null },
          count: agg[0]?.count || 0,
          averages: {
            pH: agg[0]?.avgPH ?? null,
            turbidity: agg[0]?.avgTurbidity ?? null,
            dissolvedOxygen: agg[0]?.avgDissolvedOxygen ?? null,
            temperature: agg[0]?.avgTemperature ?? null,
          },
          latest: latest || null,
          latestStatus: latestEval,
          alerts24h,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = { waterRouter };

