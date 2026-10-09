import express from "express";
import { getActive, listAll, create, activate, close } from "./financialYear.controller.js";
import { protect } from "../../middleware/auth.middleware.js";
import { requireChamaMember, requireChamaTreasurerOrChairperson } from "../../middleware/chama.middleware.js";

const router = express.Router({ mergeParams: true }); // mergeParams to get chamaId from parent router if needed

// Any active member can see the financial year(s) - it drives their own
// contribution calendar - but only the Treasurer/Chairperson may set,
// activate or close one.
router.get("/active", protect, requireChamaMember, getActive);
router.get("/", protect, requireChamaMember, listAll);
router.post("/", protect, requireChamaMember, requireChamaTreasurerOrChairperson, create);
router.patch("/:yearId/activate", protect, requireChamaMember, requireChamaTreasurerOrChairperson, activate);
router.patch("/:yearId/close", protect, requireChamaMember, requireChamaTreasurerOrChairperson, close);

export default router;