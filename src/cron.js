const cron = require("node-cron");
const pollPendingQosPay = require("./jobs/qospayPolling.job");

cron.schedule("*/1 * * * *", async () => {
  await pollPendingQosPay();
});
