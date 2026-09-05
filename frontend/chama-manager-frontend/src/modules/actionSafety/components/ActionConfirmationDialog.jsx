import React, { useState } from "react";
import { X, AlertTriangle, AlertCircle, ShieldAlert, ExternalLink, Check } from "lucide-react";
import {
  useGenerateConfirmationDialog,
  useValidateConfirmationResponse,
  useRevalidateAction,
  useWarningExplanation
} from "../hooks/useActionSafety";

/**
 * Action Confirmation Dialog Component
 * 
 * Handles 4 levels of confirmation:
 * 1. Informational - no confirmation (auto-proceed)
 * 2. Warning - one confirmation
 * 3. Critical - deliberate re-confirmation
 * 4. High-risk - step-up confirmation (type to confirm)
 */
export default function ActionConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  action,
  chamaId,
  actionData,
  loading = false
}) {
  const [typedPhrase, setTypedPhrase] = useState("");
  const [showExplanation, setShowExplanation] = useState(false);
  const [selectedWarning, setSelectedWarning] = useState(null);

  const generateDialogMutation = useGenerateConfirmationDialog();
  const validateMutation = useValidateConfirmationResponse();
  const revalidateMutation = useRevalidateAction();
  const { data: explanation } = useWarningExplanation(selectedWarning, actionData);

  // Generate dialog when opened
  React.useEffect(() => {
    if (isOpen && action && chamaId && actionData) {
      generateDialogMutation.mutate({ action, chamaId, actionData });
    }
  }, [isOpen, action, chamaId, actionData]);

  const dialog = generateDialogMutation.data?.data;
  const isLoading = generateDialogMutation.isPending;

  const handleConfirm = async () => {
    if (!dialog) return;

    // Validate confirmation response if required
    if (dialog.requiresStepUpConfirmation || dialog.requiresExplicitConfirmation) {
      const validation = await validateMutation.mutateAsync({
        action,
        dialog,
        response: { typedPhrase }
      });

      if (!validation.valid) {
        return; // Validation failed
      }
    }

    // Re-validate action before execution
    const revalidation = await revalidateMutation.mutateAsync({
      action,
      chamaId,
      actionData,
      versionToken: actionData.versionToken
    });

    if (!revalidation.valid) {
      // Show record changed error
      alert(revalidation.message);
      return;
    }

    // Proceed with action
    onConfirm(dialog);
  };

  const handleWarningClick = (warning) => {
    setSelectedWarning(warning.type);
    setShowExplanation(true);
  };

  if (!isOpen) return null;

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-600 mx-auto"></div>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // Informational - auto-proceed
  if (dialog?.type === 'informational' && dialog?.autoProceed) {
    onConfirm(dialog);
    return null;
  }

  const getIcon = () => {
    switch (dialog?.type) {
      case 'warning':
        return <AlertTriangle className="text-amber-500" size={32} />;
      case 'critical':
        return <ShieldAlert className="text-orange-500" size={32} />;
      case 'high_risk':
        return <AlertCircle className="text-red-500" size={32} />;
      default:
        return <AlertTriangle className="text-amber-500" size={32} />;
    }
  };

  const getSeverityClass = () => {
    switch (dialog?.type) {
      case 'warning':
        return 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20';
      case 'critical':
        return 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20';
      case 'high_risk':
        return 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20';
      default:
        return 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className={`w-full max-w-lg rounded-2xl border ${getSeverityClass()} dark:bg-slate-900 shadow-2xl`}>
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-slate-800">
              {dialog?.icon || getIcon()}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {dialog?.title}
              </h2>
              {dialog?.type === 'high_risk' && (
                <span className="text-xs font-bold text-red-600 dark:text-red-400">
                  HIGH-RISK ACTION
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Message */}
          <p className="text-sm text-slate-700 dark:text-slate-300">
            {dialog?.message}
          </p>

          {/* Details */}
          {dialog?.details && dialog.details.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              {dialog.details.map((detail, index) => (
                <div key={index} className="flex justify-between py-1">
                  <span className="text-xs text-slate-500 dark:text-slate-400">{detail.label}</span>
                  <span className="text-xs font-medium text-slate-900 dark:text-white">{detail.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {dialog?.warnings && dialog.warnings.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Warnings:</p>
              {dialog.warnings.map((warning, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800"
                >
                  <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={14} />
                  <div className="flex-1">
                    <p className="text-xs text-slate-700 dark:text-slate-300">{warning.message}</p>
                    <button
                      onClick={() => handleWarningClick(warning)}
                      className="text-[10px] text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 mt-1 flex items-center gap-1"
                    >
                      Why am I seeing this? <ExternalLink size={10} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Risk Factors */}
          {dialog?.riskFactors && dialog.riskFactors.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">Risk Factors:</p>
              {dialog.riskFactors.map((factor, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${
                    factor.severity === 'high' ? 'bg-red-500' :
                    factor.severity === 'medium' ? 'bg-amber-500' :
                    'bg-green-500'
                  }`} />
                  <p className="text-xs text-slate-600 dark:text-slate-400">{factor.message}</p>
                </div>
              ))}
            </div>
          )}

          {/* Type Confirmation for High-Risk */}
          {dialog?.requiresStepUpConfirmation && dialog?.requiresTypeConfirmation && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Type <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{dialog.confirmationPhrase}</span> to continue:
              </p>
              <input
                type="text"
                value={typedPhrase}
                onChange={(e) => setTypedPhrase(e.target.value.toUpperCase())}
                placeholder={`Type ${dialog.confirmationPhrase}`}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-800 dark:text-white font-mono uppercase"
              />
            </div>
          )}

          {/* Warning Explanation Modal */}
          {showExplanation && explanation && (
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{explanation.title}</h3>
                <button
                  onClick={() => setShowExplanation(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <X size={16} />
                </button>
              </div>
              <ul className="space-y-1 mb-2">
                {explanation.reasons.map((reason, index) => (
                  <li key={index} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2">
                    <span className="text-violet-500">•</span>
                    {reason}
                  </li>
                ))}
              </ul>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Policy Reference: {explanation.policyReference}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 rounded-lg"
          >
            {dialog?.cancelText || 'Cancel'}
          </button>
          <button
            onClick={handleConfirm}
            disabled={
              loading ||
              validateMutation.isPending ||
              revalidateMutation.isPending ||
              (dialog?.requiresStepUpConfirmation && dialog?.requiresTypeConfirmation && typedPhrase !== dialog?.confirmationPhrase)
            }
            className={`px-4 py-2 text-sm font-bold text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed ${
              dialog?.type === 'high_risk'
                ? 'bg-red-600 hover:bg-red-700'
                : dialog?.type === 'critical'
                ? 'bg-orange-600 hover:bg-orange-700'
                : 'bg-violet-600 hover:bg-violet-700'
            }`}
          >
            {loading || validateMutation.isPending || revalidateMutation.isPending ? (
              <span className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Processing...
              </span>
            ) : (
              dialog?.confirmText || 'Confirm'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}