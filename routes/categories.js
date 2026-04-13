const express = require("express");
const router = express.Router();

const fileMiddleware = require("../middleware/file");
const { auth } = require("../middleware/auth");
const { createCategory, getCategories } = require("../controllers/categories");

router.post("/", createCategory);
router.get("/", getCategories);

module.exports = router;
