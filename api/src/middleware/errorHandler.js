function errorHandler(err, req, res, next) {
  console.error(err);
  const isDev = process.env.NODE_ENV !== 'production';
  res.status(err.status || 500).json({
    error: isDev ? err.message : 'Internal server error'
  });
}

module.exports = errorHandler;
