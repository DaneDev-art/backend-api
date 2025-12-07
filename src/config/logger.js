// =====================================
// src/config/logger.js
// Simple logger using console + colors
// =====================================

const chalk = require("chalk");

module.exports = {
  info: (msg, ...args) => {
    console.log(chalk.blue(`[INFO] ${msg}`), ...args);
  },
  success: (msg, ...args) => {
    console.log(chalk.green(`[SUCCESS] ${msg}`), ...args);
  },
  warn: (msg, ...args) => {
    console.warn(chalk.yellow(`[WARN] ${msg}`), ...args);
  },
  error: (msg, ...args) => {
    console.error(chalk.red(`[ERROR] ${msg}`), ...args);
  },
};
