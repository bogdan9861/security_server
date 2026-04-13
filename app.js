const express = require("express");
const cors = require("cors");
const logger = require("morgan");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(cors({ origin: "*" }));

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use("/public", express.static(path.join(__dirname, "public")));

app.use("/api/users", require("./routes/users"));
app.use("/api/tickets", require("./routes/tickets"));
app.use("/api/comments", require("./routes/comments"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/notifications", require("./routes/notifications"));

module.exports = app;
