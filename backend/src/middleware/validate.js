function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      return res.status(400).json({
        ok: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: result.error.flatten() },
      });
    }

    req.validated = result.data;
    next();
  };
}

module.exports = { validate };

