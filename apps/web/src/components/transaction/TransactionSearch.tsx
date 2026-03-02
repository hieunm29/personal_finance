import { useEffect, useState } from 'react'

interface TransactionSearchProps {
  value: string
  onSearch: (value: string) => void
}

export default function TransactionSearch({ value, onSearch }: TransactionSearchProps) {
  const [local, setLocal] = useState(value)

  // Sync when parent resets (e.g. "Xóa bộ lọc")
  useEffect(() => {
    if (!value) setLocal('')
  }, [value])

  // Debounce 300ms
  useEffect(() => {
    const t = setTimeout(() => onSearch(local), 300)
    return () => clearTimeout(t)
  }, [local, onSearch])

  return (
    <div className="relative flex-1">
      <input
        type="text"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder="Tìm theo ghi chú..."
        className="block w-full rounded-md border border-gray-300 py-2 pl-3 pr-8 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
      {local && (
        <button
          type="button"
          onClick={() => { setLocal(''); onSearch('') }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          aria-label="Xóa tìm kiếm"
        >
          ✕
        </button>
      )}
    </div>
  )
}
