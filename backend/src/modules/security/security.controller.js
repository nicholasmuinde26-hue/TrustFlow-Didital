import * as Security from './security.service.js';

export async function ingest(req, res, next) { try { const result = await Security.ingestEvent(req.body); res.status(201).json({ success: true, data: result }); } catch (error) { next(error); } }
export async function center(req, res, next) { try { res.json({ success: true, data: await Security.commandCenter() }); } catch (error) { next(error); } }
export async function riskSignals(req, res, next) { try { res.json({ success: true, data: await Security.getRiskSignals() }); } catch (error) { next(error); } }
export async function alerts(req, res, next) { try { const query = {}; if (req.query.status) query.status = req.query.status.toUpperCase(); if (req.query.severity) query.severity = req.query.severity.toUpperCase(); res.json({ success: true, data: await Security.listAlerts(query) }); } catch (error) { next(error); } }
export async function alert(req, res, next) { try { const data = await Security.getAlert(req.params.alertId); if (!data) return res.status(404).json({ success: false, message: 'Security alert not found' }); res.json({ success: true, data }); } catch (error) { next(error); } }
export async function respond(req, res, next) { try { const data = await Security.respondToAlert(req.params.alertId, req.body.action, req.user._id); res.json({ success: true, data }); } catch (error) { next(error); } }