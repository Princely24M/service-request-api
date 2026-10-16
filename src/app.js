const path = require('node:path');
const express = require('express');
const cors = require('cors');

const config = require('./config');
const requestRoutes = require('./routes/requests');
const requestLogger = require('./middleware/requestLogger');
const requireJson = require('./middleware/requireJson');
const { notFound, errorHandler } = require('./middleware/errorHandlers');

function createApp({ log = true } = {}) {
  const app = express();

  app.disable('x-powered-by');
  if (log) app.use(requestLogger);

  // In development, allow local frontend servers when no explicit origins are configured.
  app.use('/api', cors({
    origin(origin, callback) {
      let localDevelopmentOrigin = false;
      if (origin && config.env !== 'production') {
        try {
          localDevelopmentOrigin = ['localhost', '127.0.0.1'].includes(new URL(origin).hostname);
        } catch { /* Invalid origins are not allowed. */ }
      }
      const allowed = config.corsOrigins.length
        ? config.corsOrigins.includes(origin)
        : localDevelopmentOrigin;
      callback(null, Boolean(origin && allowed));
    },
  }));

  app.use('/api', requireJson);
  app.use('/api', express.json({ limit: '10kb' }));

  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'skillbridge-api', time: new Date().toISOString() });
  });
  app.use('/api/requests', requestRoutes);
  app.use('/api', notFound);

  // The frontend lives in /public and is served from the same address as the API.
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use(errorHandler);
  return app;
}

module.exports = createApp;
