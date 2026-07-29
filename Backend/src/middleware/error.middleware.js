export const errorHandler = (
  err,
  req,
  res,
  next
) => {

  console.error('ERROR:', err);


  // ----------------------------------------
  // 1. Default status
  // ----------------------------------------

  let statusCode =
    err.statusCode || 500;


  // ----------------------------------------
  // 2. Default message
  // ----------------------------------------

  let message =
    err.message || 'Internal server error';


  // ----------------------------------------
  // 3. Mongoose duplicate key error
  // ----------------------------------------

  if (err.code === 11000) {

    statusCode = 409;

    const duplicateField =
      Object.keys(
        err.keyPattern || {}
      )[0] || 'field';

    message =
      `A record with this ${duplicateField} already exists`;
  }


  // ----------------------------------------
  // 4. Mongoose validation error
  // ----------------------------------------

  if (
    err.name === 'ValidationError'
  ) {

    statusCode = 400;

    message =
      Object.values(err.errors)
        .map(error => error.message)
        .join(', ');
  }


  // ----------------------------------------
  // 5. Mongoose invalid ObjectId
  // ----------------------------------------

  if (
    err.name === 'CastError'
  ) {

    statusCode = 400;

    message =
      `Invalid ${err.path}`;
  }


  // ----------------------------------------
  // 6. Hide internal errors in production
  // ----------------------------------------

  if (
    statusCode === 500 &&
    process.env.NODE_ENV === 'production'
  ) {

    message =
      'Internal server error';
  }


  // ----------------------------------------
  // 7. Send response
  // ----------------------------------------

  res.status(statusCode).json({

    success: false,

    message

  });
};