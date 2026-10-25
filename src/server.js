const env = require('./config/env');
const app = require('./app');

app.listen(env.port, () => {
  console.log(`HR Management System running on http://localhost:${env.port}`);
});
