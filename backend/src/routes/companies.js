const express = require('express');
const { z } = require('zod');

const { Roles } = require('../constants/roles');
const { requireAuth, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { Company, Config, Role, User, Device, WaterQualityReading } = require('../models');
const { hashPassword } = require('../utils/crypto');
const { httpError } = require('../utils/httpError');
const { logAudit } = require('../services/audit');

const companiesRouter = express.Router();

companiesRouter.use(requireAuth);

// SuperAdmin creates a company + its Company admin user (owner)
const createCompanySchema = z.object({
  body: z.object({
    name: z.string().min(2).max(200),
    address: z.string().max(500).optional(),
    maxManagers: z
      .union([
        z.number().int().min(0).max(500),
        z.object({
          total: z.number().int().min(0).max(500).optional(),
          manager1: z.number().int().min(0).max(500).nullable().optional(),
          manager2: z.number().int().min(0).max(500).nullable().optional(),
        }),
      ])
      .nullable()
      .optional(),
    owner: z.object({
      name: z.string().min(2).max(100),
      email: z.string().email(),
      password: z.string().min(8).max(200),
    }),
  }),
});

companiesRouter.post('/', authorize(Roles.SuperAdmin), validate(createCompanySchema), async (req, res, next) => {
  try {
    const { name, address, maxManagers, owner } = req.validated.body;

    const existingCompany = await Company.findOne({ name: name.trim() }).lean();
    if (existingCompany) throw httpError(409, 'COMPANY_EXISTS', 'Company name already in use');

    const existingOwner = await User.findOne({ email: owner.email.toLowerCase() }).lean();
    if (existingOwner) throw httpError(409, 'EMAIL_TAKEN', 'Owner email already in use');

    const parsedLimit = typeof maxManagers === 'number'
      ? maxManagers
      : (maxManagers?.total ?? (maxManagers?.manager1 ?? 2));

    const company = await Company.create({
      name,
      address: address || '',
      maxManagers: {
        total: parsedLimit,
        manager1: parsedLimit,
        manager2: parsedLimit,
      },
    });

    await Config.create({ company: company._id });

    const companyRole = await Role.findOne({ name: Roles.Company });
    if (!companyRole) throw httpError(500, 'ROLE_NOT_FOUND', 'Company role not found');

    const ownerUser = await User.create({
      name: owner.name,
      email: owner.email.toLowerCase(),
      passwordHash: await hashPassword(owner.password),
      role: companyRole._id,
      company: company._id,
      isActive: true,
    });

    company.owner = ownerUser._id;
    await company.save();

    await logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      companyId: company._id,
      action: 'COMPANY_CREATE',
      resource: 'company',
      resourceId: String(company._id),
      details: { name: company.name, ownerEmail: owner.email },
      ipAddress: req.ip,
    });

    res.status(201).json({
      ok: true,
      data: {
        company: {
          id: String(company._id),
          name: company.name,
          address: company.address,
          maxManagers: company.maxManagers,
          ownerId: String(company.owner),
        },
        owner: { id: String(ownerUser._id), email: ownerUser.email, name: ownerUser.name, role: Roles.Company },
      },
    });
  } catch (err) {
    next(err);
  }
});

companiesRouter.get('/', authorize(Roles.SuperAdmin), async (req, res, next) => {
  try {
    const companies = await Company.find().lean();
    res.json({
      ok: true,
      data: companies.map((c) => ({
        id: String(c._id),
        name: c.name,
        address: c.address || '',
        maxManagers: {
          total: c.maxManagers?.total ?? (typeof c.maxManagers === 'number' ? c.maxManagers : (c.maxManagers?.manager1 ?? 2)),
          manager1: c.maxManagers?.manager1 ?? 2,
          manager2: c.maxManagers?.manager2 ?? 2,
        },
        ownerId: c.owner ? String(c.owner) : null,
      })),
    });
  } catch (err) {
    next(err);
  }
});

companiesRouter.get('/me', authorize(Roles.Company, Roles.Manager, Roles.Manager1, Roles.Manager2), async (req, res, next) => {
  try {
    const company = await Company.findById(req.user.companyId).lean();
    if (!company) throw httpError(404, 'COMPANY_NOT_FOUND', 'Company not found');
    res.json({
      ok: true,
      data: {
        id: String(company._id),
        name: company.name,
        address: company.address || '',
        maxManagers: {
          total: company.maxManagers?.total ?? (typeof company.maxManagers === 'number' ? company.maxManagers : (company.maxManagers?.manager1 ?? 2)),
          manager1: company.maxManagers?.manager1 ?? 2,
          manager2: company.maxManagers?.manager2 ?? 2,
        },
        ownerId: company.owner ? String(company.owner) : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

const updateMeSchema = z.object({
  body: z
    .object({
      name: z.string().min(2).max(200).optional(),
      address: z.string().max(500).optional(),
    })
    .strict(),
});

companiesRouter.put('/me', authorize(Roles.Company), validate(updateMeSchema), async (req, res, next) => {
  try {
    const company = await Company.findById(req.user.companyId);
    if (!company) throw httpError(404, 'COMPANY_NOT_FOUND', 'Company not found');
    if (req.validated.body.name) company.name = req.validated.body.name;
    if (req.validated.body.address !== undefined) company.address = req.validated.body.address;
    await company.save();
    res.json({ ok: true, data: { id: String(company._id), name: company.name, address: company.address } });
  } catch (err) {
    next(err);
  }
});

companiesRouter.delete('/:id', authorize(Roles.SuperAdmin), async (req, res, next) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) throw httpError(404, 'COMPANY_NOT_FOUND', 'Company not found');

    await Promise.all([
      User.deleteMany({ company: company._id }),
      Config.deleteMany({ company: company._id }),
      Device.deleteMany({ company: company._id }),
      WaterQualityReading.deleteMany({ company: company._id }),
    ]);

    await Company.findByIdAndDelete(company._id);

    await logAudit({
      userId: req.user.id,
      userEmail: req.user.email,
      companyId: company._id,
      action: 'COMPANY_DELETE',
      resource: 'company',
      resourceId: String(company._id),
      details: { name: company.name },
      ipAddress: req.ip,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = { companiesRouter };

