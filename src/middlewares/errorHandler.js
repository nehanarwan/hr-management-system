
function errorHandler(err, req, res, next) { 
  const status = err.status || 500;

  if (status >= 500) {
    console.error(`[${req.method} ${req.originalUrl}] ${err.message}`);
  }

  res.status(status).json({
    success: false,
    message: status >= 500 ? 'Something went wrong on the server' : err.message,
  });
}

module.exports = errorHandler;
