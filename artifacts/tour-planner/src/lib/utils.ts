import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format } from "date-fns"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "N/A"
  try {
    return format(new Date(dateString), "MMM d, yyyy")
  } catch (e) {
    return dateString
  }
}

export function formatTime(dateString: string | null | undefined): string {
  if (!dateString) return "N/A"
  try {
    return format(new Date(dateString), "h:mm a")
  } catch (e) {
    return dateString
  }
}

export function getStatusColor(status: string) {
  switch (status) {
    case 'published':
    case 'approved':
      return 'bg-green-100 text-green-800 border-green-200'
    case 'active':
    case 'pending':
      return 'bg-blue-100 text-blue-800 border-blue-200'
    case 'declined':
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200'
    case 'needs_follow_up':
    case 'restricted':
      return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'draft':
    case 'not_requested':
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}
