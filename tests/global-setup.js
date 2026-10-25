const path = require('path');
const { execSync } = require('child_process');

module.exports = () => {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env.test'), override: true, quiet: true });
  execSync('npx node-pg-migrate up', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
    env: { ...process.env },
  });
};