import * as businessService from "./business.service.js";

const sendError = (error, response, next) => {
  if (error.statusCode) return response.status(error.statusCode).json({ success: false, message: error.message });
  return next(error);
};

/**
 * GET /api/v1/storefront/:slug
 * Public read of a seller's storefront + live, in-stock catalog.
 * No auth — this is the ONLY thing a buyer without the app ever sees.
 */
export const getPublicStorefront = async (request, response, next) => {
  try {
    const data = await businessService.getPublicStorefrontBySlug(request.params.slug);
    response.json({ success: true, data });
  } catch (error) { sendError(error, response, next); }
};

/**
 * POST /api/v1/storefront/:slug/orders
 * Public order placement — no account required. Deducts live stock
 * from the same inventory the seller's POS and dashboard use.
 */
export const placeStorefrontOrder = async (request, response, next) => {
  try {
    const result = await businessService.createStorefrontOrder(request.params.slug, request.body);
    response.status(201).json({ success: true, message: "Order placed", data: result });
  } catch (error) { sendError(error, response, next); }
};

/**
 * GET /api/v1/storefront/track/:orderCode?phone=...
 * Public order lookup by order code (+ optional phone confirmation).
 * No login — buyers track by code, the same way they'd track any
 * independent online order.
 */
export const trackOrder = async (request, response, next) => {
  try {
    const result = await businessService.trackStorefrontOrder(request.params.orderCode, request.query.phone);
    response.json({ success: true, data: result });
  } catch (error) { sendError(error, response, next); }
};
