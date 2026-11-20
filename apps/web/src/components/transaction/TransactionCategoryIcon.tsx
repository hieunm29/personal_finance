import type { ReactNode, SVGProps } from 'react'

interface TransactionCategoryIconProps extends Omit<SVGProps<SVGSVGElement>, 'color'> {
  icon?: string | null
  name?: string
  size?: number
  color?: string
}

const ICON_PATHS: Record<string, ReactNode> = {
  utensils: <><path d="M4 3v7a2 2 0 0 0 2 2h3V3" /><path d="M7 3v18" /><path d="M15 3v18" /><path d="M15 3c3 1 4 4 4 7v3h-4" /></>,
  car: <><path d="m5 17-1 3" /><path d="m19 17 1 3" /><path d="M3 17h18v-5l-2-5H5l-2 5z" /><path d="M5 7h14" /><circle cx="7" cy="17" r="1" /><circle cx="17" cy="17" r="1" /></>,
  house: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></>,
  home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9" /><path d="M9 20v-6h6v6" /></>,
  zap: <path d="m13 2-9 12h7l-1 8 9-12h-7z" />,
  pill: <><path d="m10.5 20.5 9-9a4.95 4.95 0 0 0-7-7l-9 9a4.95 4.95 0 0 0 7 7Z" /><path d="m8 8 8 8" /></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
  shirt: <path d="m8 4 4 2 4-2 5 3-3 5-2-1v11H8V11l-2 1-3-5z" />,
  'book-open': <><path d="M2 4v16a2 2 0 0 0 2 2h6V6a2 2 0 0 0-2-2z" /><path d="M22 4v16a2 2 0 0 1-2 2h-6V6a2 2 0 0 1 2-2z" /></>,
  sparkles: <><path d="m12 3-1 5-4 1 4 1 1 5 1-5 4-1-4-1z" /><path d="m19 14-.5 2.5L16 17l2.5.5L19 20l.5-2.5L22 17l-2.5-.5z" /><path d="m5 14-.5 1.5L3 16l1.5.5L5 18l.5-1.5L7 16l-1.5-.5z" /></>,
  coffee: <><path d="M3 8h14v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z" /><path d="M17 10h1a4 4 0 1 1 0 8h-1" /><path d="M6 2v3M10 2v3M14 2v3" /></>,
  'gamepad-2': <><path d="M6 11h4M8 9v4" /><path d="M15 12h.01M18 10h.01" /><path d="M7.5 6h9a5.5 5.5 0 0 1 5.3 7l-1.1 4a2.6 2.6 0 0 1-4.9.4L15 16H9l-.8 1.4a2.6 2.6 0 0 1-4.9-.4l-1.1-4A5.5 5.5 0 0 1 7.5 6Z" /></>,
  plane: <path d="m22 2-7 20-4-9-9-4Z" />,
  dumbbell: <><path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" /></>,
  gift: <><rect x="3" y="8" width="18" height="13" rx="2" /><path d="M12 8v13M3 12h18M12 8H8.5a2.5 2.5 0 1 1 2.5-2.5V8ZM12 8h3.5A2.5 2.5 0 1 0 13 5.5V8Z" /></>,
  handshake: <><path d="m11 8 2-2a3 3 0 0 1 4 0l4 4a3 3 0 0 1 0 4l-4 4a3 3 0 0 1-4 0l-2-2" /><path d="m13 16-2 2a3 3 0 0 1-4 0l-4-4a3 3 0 0 1 0-4l4-4a3 3 0 0 1 4 0l2 2" /><path d="m8 12 2 2 6-6" /></>,
  briefcase: <><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /><path d="M10 12v2h4v-2" /></>,
  'party-popper': <><path d="m3 21 8-8" /><path d="m5 19 4 2 3-8-7 6Z" /><path d="m14 5 1-3M18 7l3-1M17 3l2-2M20 11h2" /></>,
  'clipboard-list': <><rect x="5" y="4" width="14" height="18" rx="2" /><path d="M9 4V2h6v2M9 10h6M9 14h6M9 18h3" /></>,
  laptop: <><rect x="4" y="4" width="16" height="12" rx="1" /><path d="M2 20h20" /></>,
  landmark: <><path d="m3 10 9-7 9 7" /><path d="M5 10h14M6 10v8M10 10v8M14 10v8M18 10v8M3 20h18" /></>,
  'trending-up': <><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>,
  'chart-line': <><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 6-7" /></>,
  ribbon: <><path d="M6 3h12v8a6 6 0 1 1-12 0z" /><path d="m8 18-1 4 5-3 5 3-1-4" /></>,
  wallet: <><path d="M20 7V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h16v10a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3V6" /><path d="M16 15h.01" /></>,
}

export default function TransactionCategoryIcon({ icon, name, size = 18, color, ...props }: TransactionCategoryIconProps) {
  const fallback = icon && icon.length <= 2 ? icon : name?.trim().slice(0, 1).toUpperCase() || '?'
  const content = icon && ICON_PATHS[icon] ? ICON_PATHS[icon] : <text x="12" y="16" textAnchor="middle" fontSize="12" fontWeight="700">{fallback}</text>
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
      {content}
    </svg>
  )
}
