const {join} = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer.
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
  
  // Download Chrome for current platform
  skipDownload: false,
  
  // Use the bundled Chrome instead of system Chrome
  defaultProduct: 'chrome',
  
  // Configure for Replit deployment
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
};