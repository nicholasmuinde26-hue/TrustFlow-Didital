export const errorHandler = (err, req, res, next) => {
  // ----------------------------------------
  // 1. Default status
  // ----------------------------------------

  let statusCode = err.statusCode || 500;

  // ----------------------------------------
  // 2. Default message
  // ----------------------------------------

  let message =
    err.message || "Internal server error";

  // ----------------------------------------
  // 3. Mongoose duplicate key error
  // ----------------------------------------

  if (err.code === 11000) {
    statusCode = 409;

    const duplicateField =
      Object.keys(err.keyPattern || {})[0] || "field";

    message =
      `A record with this ${duplicateField} already exists`;
  }

  // ----------------------------------------
  // 4. Mongoose validation error
  // ----------------------------------------

  if (err.name === "ValidationError") {
    statusCode = 400;

    message = Object.values(err.errors)
      .map((error) => error.message)
      .join(", ");
  }

  // ----------------------------------------
  // 5. Mongoose invalid ObjectId
  // ----------------------------------------

  if (err.name === "CastError") {
    statusCode = 400;

    message = `Invalid ${err.path}`;
  }

  // ----------------------------------------
  // 6. DEVELOPMENT ERROR LOGGING
  // ----------------------------------------

  console.error("\n");
  console.error("══════════════════════════════════════");
  console.error("🔥 BACKEND ERROR");
  console.error("══════════════════════════════════════");

  console.error("Method:", req.method);
  console.error("URL:", req.originalUrl);
  console.error("Status:", statusCode);
  console.error("Error Name:", err.name);
  console.error("Error Code:", err.code);
  console.error("Message:", err.message);

  // Request ID if available
  if (req.requestId) {
    console.error("Request ID:", req.requestId);
  }

  console.error("Stack:");
  console.error(err.stack);

  console.error("══════════════════════════════════════");
  console.error("\n");

  // ----------------------------------------
  // 7. Hide internal errors in production
  // ----------------------------------------

  if (
    statusCode === 500 &&
    process.env.NODE_ENV === "production"
  ) {
    message = "Internal server error";
  }

  // ----------------------------------------
  // 8. Send response
  // ----------------------------------------

  // A STRING err.code is a deliberate machine-readable signal for the
  // client (e.g. LEADERSHIP_PIN_REQUIRED, LEADERSHIP_STEP_UP_REQUIRED)
  // and must survive into production — the frontend keys its PIN prompt
  // off it. Mongo's own err.code is numeric (11000), so this narrowing
  // keeps driver internals out of the response.
  const clientCode = typeof err.code === "string" ? err.code : undefined;

  res.status(statusCode).json({
    success: false,
    message,

    ...(clientCode && { code: clientCode }),
    ...(err.stepUpAction && { stepUpAction: err.stepUpAction }),

    ...(process.env.NODE_ENV !== "production" && {
      error: err.name,
      stack: err.stack,
    }),
  });
};