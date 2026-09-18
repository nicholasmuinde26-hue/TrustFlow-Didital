import mongoose from 'mongoose';

const securityIncidentSchema = new mongoose.Schema({
  number: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  status: { type: String, enum: ['OPEN', 'INVESTIGATING', 'CONTAINED', 'RESOLVED'], default: 'OPEN' },
  severity: { type: String, enum: ['HIGH', 'CRITICAL'], required: true },
  alertId: { type: mongoose.Schema.Types.ObjectId, ref: 'SecurityAlert', required: true },
  timeline: [{ at: { type: Date, default: Date.now }, event: String, detail: String }],
}, { timestamps: true });
export default mongoose.model('SecurityIncident', securityIncidentSchema);
