const express = require("express");
const router = express.Router();
const auth = require("../middlewares/auth.middleware");

const {
  getMyPayinTransactions,
} = require("../controllers/payinTransaction.controller");

const {
  getMyPayoutTransactions,
} = require("../controllers/payoutTransaction.controller");

router.get("/me/payin-transactions", auth, getMyPayinTransactions);
router.get("/me/payout-transactions", auth, getMyPayoutTransactions);

module.exports = router;
