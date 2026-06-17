import React from 'react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  saveLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onSave?: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  open,
  title,
  message,
  confirmLabel = 'Replace',
  cancelLabel = 'Cancel',
  saveLabel,
  onConfirm,
  onCancel,
  onSave,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* Modal */}
      <div className="relative w-96 max-w-[90vw] bg-white dark:bg-[#252f3b] rounded-xl shadow-2xl border border-gray-200 dark:border-gray-600 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
            {title}
          </h2>
        </div>
        {/* Body */}
        <div className="px-5 pb-5">
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {message}
          </p>
        </div>
        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-3 bg-gray-50 dark:bg-[#1e2730] border-t border-gray-200 dark:border-gray-600">
          <button
            className="px-4 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-[#2a3642] border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#333f4a] transition-colors"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          {onSave && (
            <button
              className="px-4 py-1.5 text-xs font-medium rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors"
              onClick={onSave}
            >
              {saveLabel || 'Save'}
            </button>
          )}
          <button
            className="px-4 py-1.5 text-xs font-medium rounded-md bg-red-500 text-white hover:bg-red-600 transition-colors"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
