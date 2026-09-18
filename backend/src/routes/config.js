const express = require('express');
const { z } = require('zod');

const { Roles } = require('../constants/roles');
const { requireAuth, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { Config } = require('../models');
const { httpError } = require('../utils/httpError');

const configRouter = express.Router();

configRouter.use(requireAuth);

configRouter.get('/me', authorize(Roles.Company, Roles.Manager1, Roles.Manager2), async (req, res, next) => {
  try {
    const cfg = await Config.findOne({ company: req.user.companyId }).lean();
    if (!cfg) throw httpError(404, 'CONFIG_NOT_FOUND', 'Config not found');
    res.json({ ok: true, data: cfg });
  } catch (err) {
    next(err);
  }
});

configRouter.get('/company/:companyId', authorize(Roles.SuperAdmin, Roles.Company, Roles.Manager1, Roles.Manager2), async (req, res, next) => {
  try {
    if (req.user.role !== Roles.SuperAdmin && String(req.user.companyId) !== String(req.params.companyId)) {
      return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'Cannot access company config outside your company' } });
    }

    const cfg = await Config.findOne({ company: req.params.companyId }).lean();
    if (!cfg) {
      res.json({
        ok: true,
        data: {
          company: req.params.companyId,
          thingspeak: {
            enabled: false,
            channelId: '',
            readKey: '',
            writeKey: '',
            apiBaseUrl: 'https://api.thingspeak.com',
          },
        },
      });
      return;
    }
    res.json({ ok: true, data: cfg });
  } catch (err) {
    next(err);
  }
});

const updateSchema = z.object({
  body: z
    .object({
      pHMin: z.number().optional(),
      pHMax: z.number().optional(),
      turbidityMax: z.number().optional(),
      dissolvedOxygenMin: z.number().optional(),
      temperatureMax: z.number().optional(),
      thingspeak: z
        .object({
          enabled: z.boolean().optional(),
          channelId: z.string().optional(),
          readKey: z.string().optional(),
          writeKey: z.string().optional(),
          apiBaseUrl: z.string().optional(),
        })
        .optional(),
    })
    .strict(),
});

configRouter.put('/me', authorize(Roles.Company), validate(updateSchema), async (req, res, next) => {
  try {
    const cfg = await Config.findOne({ company: req.user.companyId });
    if (!cfg) throw httpError(404, 'CONFIG_NOT_FOUND', 'Config not found');
    Object.assign(cfg, req.validated.body);
    await cfg.save();
    res.json({ ok: true, data: cfg });
  } catch (err) {
    next(err);
  }
});

configRouter.put('/company/:companyId', authorize(Roles.SuperAdmin, Roles.Company), validate(updateSchema), async (req, res, next) => {
  try {
    if (req.user.role === Roles.Company && String(req.user.companyId) !== String(req.params.companyId)) {
      return res.status(403).json({ ok: false, error: { code: 'FORBIDDEN', message: 'Cannot update company config outside your company' } });
    }

    const cfg = await Config.findOne({ company: req.params.companyId });
    if (!cfg) {
      const created = await Config.create({
        company: req.params.companyId,
        thingspeak: {
          enabled: !!req.validated.body.thingspeak?.enabled,
          channelId: req.validated.body.thingspeak?.channelId ?? '',
          readKey: req.validated.body.thingspeak?.readKey ?? '',
          writeKey: req.validated.body.thingspeak?.writeKey ?? '',
          apiBaseUrl: req.validated.body.thingspeak?.apiBaseUrl ?? 'https://api.thingspeak.com',
        },
      });
      res.json({ ok: true, data: created });
      return;
    }

    if (req.validated.body.thingspeak) {
      if (!cfg.thingspeak) cfg.thingspeak = {};
      Object.assign(cfg.thingspeak, req.validated.body.thingspeak);
      cfg.markModified('thingspeak');
    }

    Object.keys(req.validated.body).forEach((key) => {
      if (key !== 'thingspeak') cfg[key] = req.validated.body[key];
    });

    await cfg.save();
    res.json({ ok: true, data: cfg });
  } catch (err) {
    next(err);
  }
});

module.exports = { configRouter };

