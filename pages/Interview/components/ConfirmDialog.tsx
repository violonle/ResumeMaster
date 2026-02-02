import React from 'react';
import {AnimatePresence, motion} from 'framer-motion';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  customContent?: React.ReactNode;
  hideButtons?: boolean;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  confirmVariant = 'primary',
  onConfirm,
  onCancel,
  loading = false,
  customContent,
  hideButtons = false
}: ConfirmDialogProps) {
  if (!open) return null;

  const variantStyles = {
    danger: 'bg-red-600 shadow-red-600/20 hover:bg-red-700',
    primary: 'bg-blue-600 shadow-blue-600/20 hover:bg-blue-700',
    warning: 'bg-indigo-600 shadow-indigo-600/20 hover:bg-indigo-700'
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-50"
          />
          
          {/* 对话框 */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-[2.5rem] shadow-2xl max-w-md w-full p-8 sm:p-10"
            >
              {/* 标题 */}
              <h3 className="text-xl sm:text-2xl font-black text-gray-900 mb-4 tracking-tight">
                {title}
              </h3>
              
              {/* 内容 */}
              <div className="text-sm sm:text-base text-gray-500 font-medium mb-8 leading-relaxed">
                {typeof message === 'string' ? (
                  message && <p className="whitespace-pre-line">{message}</p>
                ) : (
                  message
                )}
                {customContent}
              </div>

              {/* 按钮 */}
              {!hideButtons && (
                <div className="flex flex-col sm:flex-row gap-3 justify-end">
                  <button
                    onClick={onCancel}
                    disabled={loading}
                    className="w-full sm:w-auto order-2 sm:order-1 px-8 py-4 bg-white text-gray-600 border-2 border-gray-100 rounded-2xl font-black hover:bg-gray-50 transition-all disabled:opacity-50 text-sm sm:text-base"
                  >
                    {cancelText}
                  </button>
                  <button
                    onClick={onConfirm}
                    disabled={loading}
                    className={`w-full sm:w-auto order-1 sm:order-2 px-8 py-4 text-white rounded-2xl font-black shadow-xl transition-all disabled:opacity-50 text-sm sm:text-base ${variantStyles[confirmVariant]}`}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <motion.span
                          className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        />
                        处理中...
                      </span>
                    ) : (
                      confirmText
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
