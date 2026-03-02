interface DeleteTransactionDialogProps {
  onConfirm: () => void
  onCancel: () => void
  isPending: boolean
}

export default function DeleteTransactionDialog({
  onConfirm,
  onCancel,
  isPending,
}: DeleteTransactionDialogProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-700">
        Bạn có chắc muốn xóa giao dịch này? Hành động này không thể hoàn tác.
      </p>
      <div className="flex gap-3 justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Hủy
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={isPending}
          className="rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? 'Đang xóa...' : 'Xóa'}
        </button>
      </div>
    </div>
  )
}
