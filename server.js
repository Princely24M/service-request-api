const config = require('./src/config');
const createApp = require('./src/app');
const store = require('./src/data/store');

store.seed();

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`SkillBridge API running at http://localhost:${config.port}`);
  console.log(`Environment: ${config.env}`);
});

process.on('SIGINT', () => server.close(() => process.exit(0)));
