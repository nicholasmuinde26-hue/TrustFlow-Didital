import mongoose from 'mongoose';

const burialChamaSetupProgressSchema = new mongoose.Schema({
  chama_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chama',
    required: true,
    unique: true,
    index: true,
  },
  current_step: { type: Number, min: 1, max: 10, default: 1 },
  completed_steps: { type: [Number], default: [] },
  step_data: { type: mongoose.Schema.Types.Mixed, default: {} },
  status: { type: String, enum: ['in_progress', 'completed', 'abandoned'], default: 'in_progress' },
  started_at: { type: Date, default: Date.now },
  last_saved_at: { type: Date, default: Date.now },
  completed_at: { type: Date, default: null },
  updated_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: true });

export default mongoose.model('BurialChamaSetupProgress', burialChamaSetupProgressSchema);
