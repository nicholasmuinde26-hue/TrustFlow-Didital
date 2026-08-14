import * as businessService from "./business.service.js";

const sendError = (error, response, next) => {
  if (error.statusCode) return response.status(error.statusCode).json({ success: false, message: error.message });
  return next(error);
};

export const createBusiness = async (request, response, next) => {
  try { response.status(201).json({ success: true, data: await businessService.createBusiness(request.body, request.user) }); }
  catch (error) { sendError(error, response, next); }
};

export const getSummary = async (request, response, next) => {
  try { response.json({ success: true, data: await businessService.getSummary(request.params.businessId, request.user) }); }
  catch (error) { sendError(error, response, next); }
};

const list = (type) => async (request, response, next) => {
  try { response.json({ success: true, data: await businessService.listTransactions(request.params.businessId, request.user, type) }); }
  catch (error) { sendError(error, response, next); }
};

const create = (type) => async (request, response, next) => {
  try {
    const result = await businessService.createTransaction(request.params.businessId, request.user, type, request.body);
    response.status(result.stk ? 202 : 201).json({ success: true, message: result.stk ? "STK Push sent" : "Transaction recorded", data: { transaction: result.transaction, ...result.stk } });
  } catch (error) { sendError(error, response, next); }
};

export const listSales = list("sale");
export const listExpenses = list("expense");
export const createSale = create("sale");
export const createExpense = create("expense");

export const customerPayout = async (request, response, next) => {
  try {
    const result = await businessService.initiateCustomerPayout(request.params.businessId, request.user, request.body);
    response.status(202).json({ success: true, message: "M-Pesa B2C payout submitted", data: { transaction: result.transaction, ...result.payout } });
  } catch (error) { sendError(error, response, next); }
};

export const initiateStkPush = async (request, response, next) => {
  try {
    const result = await businessService.initiateStkPush(request.params.businessId, request.user, request.body);
    response.status(202).json({ success: true, message: "M-Pesa STK Push sent", data: { transaction: result.transaction, ...result.stk } });
  } catch (error) { sendError(error, response, next); }
};

export const queryStkStatus = async (request, response, next) => {
  try {
    const result = await businessService.checkStkStatus(request.params.businessId, request.params.transactionId, request.user);
    response.json({ success: true, data: result });
  } catch (error) { sendError(error, response, next); }
};

export const forceCompleteTransaction = async (request, response, next) => {
  try {
    const result = await businessService.forceCompleteTransaction(request.params.businessId, request.params.transactionId, request.user);
    response.json({ success: true, data: result });
  } catch (error) { sendError(error, response, next); }
};


export const listCustomers = async (request, response, next) => {
  try { response.json({ success: true, data: await businessService.listCustomers(request.params.businessId, request.user) }); }
  catch (error) { sendError(error, response, next); }
};

export const createCustomer = async (request, response, next) => {
  try { response.status(201).json({ success: true, data: await businessService.createCustomer(request.params.businessId, request.user, request.body) }); }
  catch (error) { sendError(error, response, next); }
};

export const listSuppliers = async (request, response, next) => {
  try { response.json({ success: true, data: await businessService.listSuppliers(request.params.businessId, request.user) }); }
  catch (error) { sendError(error, response, next); }
};

export const createSupplier = async (request, response, next) => {
  try { response.status(201).json({ success: true, data: await businessService.createSupplier(request.params.businessId, request.user, request.body) }); }
  catch (error) { sendError(error, response, next); }
};

export const getBusinessAccounts = async (request, response, next) => {
  try { response.json({ success: true, data: await businessService.getBusinessAccounts(request.params.businessId, request.user) }); }
  catch (error) { sendError(error, response, next); }
};

