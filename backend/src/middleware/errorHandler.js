function errorHandler(err, req, res, next) {
  let status = typeof err?.status === 'number' ? err.status : 500;
  let code = err?.code || (status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST');
  let message = err?.message || 'Unexpected error';

  if (err?.code === 11000 || (err?.name === 'MongoServerError' && err?.code === 11000)) {
    status = 409;
    code = 'DUPLICATE_RECORD';
    const field = Object.keys(err.keyPattern || {})[0] || 'field';
    message = `A record with this ${field} already exists`;
  }

  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(status).json({
    ok: false,
    error: { code, message },
  });
}

module.exports = { errorHandler };

