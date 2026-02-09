require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

module.exports = {
  port: process.env.PORT || 3000,
  googleSheetsId: process.env.GOOGLE_SHEETS_ID || '',
  googleServiceAccountPath: process.env.GOOGLE_SERVICE_ACCOUNT_PATH || './server/credentials/service-account.json',
  cachePath: require('path').join(__dirname, 'cache', 'data-cache.json'),
  googleTimeout: parseInt(process.env.GOOGLE_TIMEOUT, 10) || 10000,
};
