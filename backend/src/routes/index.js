const express = require('express');

const { authRouter } = require('./auth');
const { usersRouter } = require('./users');
const { companiesRouter } = require('./companies');
const { configRouter } = require('./config');
const { devicesRouter } = require('./devices');
const { waterRouter } = require('./water');
const { iotRouter } = require('./iotData');
const { auditRouter } = require('./audit');

const apiRouter = express.Router();

apiRouter.get('/', (req, res) => {
  res.json({ ok: true, message: 'IoT Platform API root' });
});

apiRouter.use('/auth', authRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/companies', companiesRouter);
apiRouter.use('/config', configRouter);
apiRouter.use('/devices', devicesRouter);
apiRouter.use('/iot', iotRouter);
apiRouter.use('/audit-logs', auditRouter);
apiRouter.use('/water', waterRouter);

module.exports = { apiRouter };
