import Decimal from 'decimal.js';


// ========================================
// FINANCIAL DECIMAL CONFIGURATION
// ========================================
//
// Decimal.js is used as the arithmetic layer
// for all financial calculations.
//
// MongoDB:
//     Decimal128
//
// Application:
//     Decimal.js
//
// Never use JavaScript Number for financial
// arithmetic.
//
// ========================================


// ========================================
// DECIMAL CONFIGURATION
// ========================================
//
// We configure Decimal.js with high precision.
//
// 40 significant digits is more than enough
// for normal Chama financial operations while
// giving us a large safety margin for:
//
// - interest calculations
// - loan calculations
// - contribution calculations
// - account balances
// - transaction totals
//
// ========================================

Decimal.set({

  precision: 40,

  rounding:
    Decimal.ROUND_HALF_UP

});


// ========================================
// CREATE DECIMAL
// ========================================
//
// Safely creates a Decimal instance.
//
// Accepted values:
//
// - string
// - number
// - Decimal
// - MongoDB Decimal128
//
// IMPORTANT:
//
// Financial values should preferably enter
// the system as strings.
//
// Example:
//
// toDecimal('100.50')
//
// ========================================

export const toDecimal = (
  value
) => {

  if (
    value === null ||
    value === undefined
  ) {

    return new Decimal(0);

  }


  // --------------------------------------
  // MongoDB Decimal128
  // --------------------------------------

  if (
    typeof value.toString === 'function'
  ) {

    return new Decimal(
      value.toString()
    );

  }


  return new Decimal(
    value
  );

};


// ========================================
// CONVERT TO MONGODB DECIMAL128
// ========================================
//
// Converts Decimal.js into a MongoDB
// Decimal128-compatible string.
//
// Usage:
//
// Decimal128.fromString(
//   decimalToMongo(value)
// )
//
// ========================================

export const decimalToMongo = (
  value
) => {

  return toDecimal(
    value
  ).toFixed();

};


// ========================================
// ADD
// ========================================

export const addMoney = (
  ...values
) => {

  return values.reduce(

    (
      total,
      value
    ) => {

      return total.plus(
        toDecimal(value)
      );

    },

    new Decimal(0)

  );

};


// ========================================
// SUBTRACT
// ========================================

export const subtractMoney = (
  value,
  ...subtractValues
) => {

  return subtractValues.reduce(

    (
      total,
      current
    ) => {

      return total.minus(
        toDecimal(current)
      );

    },

    toDecimal(value)

  );

};


// ========================================
// MULTIPLY
// ========================================

export const multiplyMoney = (
  value,
  multiplier
) => {

  return toDecimal(
    value
  ).times(

    toDecimal(
      multiplier
    )

  );

};


// ========================================
// DIVIDE
// ========================================

export const divideMoney = (
  value,
  divisor
) => {

  const decimalDivisor =
    toDecimal(
      divisor
    );


  if (
    decimalDivisor.isZero()
  ) {

    throw new Error(
      'Cannot divide by zero'
    );

  }


  return toDecimal(
    value
  ).div(
    decimalDivisor
  );

};


// ========================================
// COMPARE MONEY
// ========================================
//
// Returns:
//
// -1 → first value is smaller
//  0 → values are equal
//  1 → first value is greater
//
// ========================================

export const compareMoney = (
  first,
  second
) => {

  return toDecimal(
    first
  ).cmp(

    toDecimal(
      second
    )

  );

};


// ========================================
// EQUAL MONEY
// ========================================

export const isMoneyEqual = (
  first,
  second
) => {

  return compareMoney(
    first,
    second
  ) === 0;

};


// ========================================
// GREATER THAN
// ========================================

export const isMoneyGreaterThan = (
  first,
  second
) => {

  return compareMoney(
    first,
    second
  ) > 0;

};


// ========================================
// GREATER THAN OR EQUAL
// ========================================

export const isMoneyGreaterThanOrEqual = (
  first,
  second
) => {

  return compareMoney(
    first,
    second
  ) >= 0;

};


// ========================================
// LESS THAN
// ========================================

export const isMoneyLessThan = (
  first,
  second
) => {

  return compareMoney(
    first,
    second
  ) < 0;

};


// ========================================
// LESS THAN OR EQUAL
// ========================================

export const isMoneyLessThanOrEqual = (
  first,
  second
) => {

  return compareMoney(
    first,
    second
  ) <= 0;

};


// ========================================
// CHECK ZERO
// ========================================

export const isMoneyZero = (
  value
) => {

  return toDecimal(
    value
  ).isZero();

};


// ========================================
// CHECK POSITIVE
// ========================================

export const isMoneyPositive = (
  value
) => {

  return toDecimal(
    value
  ).greaterThan(0);

};


// ========================================
// CHECK NEGATIVE
// ========================================

export const isMoneyNegative = (
  value
) => {

  return toDecimal(
    value
  ).lessThan(0);

};


// ========================================
// ABSOLUTE VALUE
// ========================================

export const absoluteMoney = (
  value
) => {

  return toDecimal(
    value
  ).abs();

};


// ========================================
// ROUND MONEY
// ========================================
//
// Rounds to two decimal places.
//
// This is useful for standard monetary
// display and calculations where the
// currency uses two decimal places.
//
// ========================================

export const roundMoney = (
  value,
  decimalPlaces = 2
) => {

  return toDecimal(
    value
  ).toDecimalPlaces(

    decimalPlaces,

    Decimal.ROUND_HALF_UP

  );

};


// ========================================
// FORMAT MONEY
// ========================================
//
// Returns a string suitable for storage,
// display, or API responses.
//
// Example:
//
// formatMoney('1000.50')
//
// returns:
//
// "1000.50"
//
// ========================================

export const formatMoney = (
  value,
  decimalPlaces = 2
) => {

  return toDecimal(
    value
  ).toFixed(

    decimalPlaces

  );

};


// ========================================
// SUM MONEY VALUES
// ========================================

export const sumMoney = (
  values
) => {

  if (
    !Array.isArray(values)
  ) {

    return new Decimal(0);

  }


  return values.reduce(

    (
      total,
      value
    ) => {

      return total.plus(

        toDecimal(
          value
        )

      );

    },

    new Decimal(0)

  );

};


// ========================================
// EXPORT DECIMAL CLASS
// ========================================
//
// Sometimes the Finance Engine will need
// direct access to Decimal.js.
//
// ========================================

export {
  Decimal
};


export default Decimal;