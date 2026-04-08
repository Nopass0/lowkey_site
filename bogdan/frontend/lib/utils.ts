import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format, isToday, isYesterday, parseISO } from 'date-fns'
import {
  FileText, Image, Video, Music, Archive, Code, File,
  FileSpreadsheet, FileJson, FileType, Presentation
} from 'lucide-react'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string): string {
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr)
    if (isToday(date)) return format(date, 'HH:mm')
    if (isYesterday(date)) return 'Yesterday'
    if (date > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) return format(date, 'EEE')
    return format(date, 'MMM d')
  } catch {
    return ''
  }
}

export function formatDateFull(dateStr: string): string {
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr)
    return format(date, 'MMM d, yyyy \'at\' HH:mm')
  } catch {
    return ''
  }
}

export function formatRelativeDate(dateStr: string): string {
  try {
    const date = typeof dateStr === 'string' ? parseISO(dateStr) : new Date(dateStr)
    return formatDistanceToNow(date, { addSuffix: true })
  } catch {
    return ''
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export function getFileIcon(mimeType?: string, fileName?: string) {
  const ext = fileName?.split('.').pop()?.toLowerCase()
  const mime = mimeType?.toLowerCase() || ''

  if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'ico', 'bmp'].includes(ext || '')) {
    return Image
  }
  if (mime.startsWith('video/') || ['mp4', 'avi', 'mov', 'mkv', 'webm', 'flv'].includes(ext || '')) {
    return Video
  }
  if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a'].includes(ext || '')) {
    return Music
  }
  if (mime.includes('zip') || mime.includes('tar') || mime.includes('gzip') || ['zip', 'tar', 'gz', 'rar', '7z', 'bz2'].includes(ext || '')) {
    return Archive
  }
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'cs', 'lua', 'sh', 'bash'].includes(ext || '') || mime.includes('javascript') || mime.includes('typescript') || mime.includes('python')) {
    return Code
  }
  if (mime.includes('spreadsheet') || ['xlsx', 'xls', 'csv', 'ods'].includes(ext || '')) {
    return FileSpreadsheet
  }
  if (mime.includes('presentation') || ['pptx', 'ppt', 'odp', 'key'].includes(ext || '')) {
    return Presentation
  }
  if (mime.includes('json') || ext === 'json') {
    return FileJson
  }
  if (mime.includes('html') || mime.includes('css') || ['html', 'htm', 'css', 'xml'].includes(ext || '')) {
    return FileType
  }
  if (mime.includes('pdf') || ext === 'pdf') {
    return FileText
  }
  if (mime.includes('word') || mime.includes('document') || ['doc', 'docx', 'odt', 'rtf', 'txt', 'md'].includes(ext || '')) {
    return FileText
  }

  return File
}

export function getFileColor(mimeType?: string, fileName?: string): string {
  const ext = fileName?.split('.').pop()?.toLowerCase()
  const mime = mimeType?.toLowerCase() || ''

  if (mime.startsWith('image/')) return '#06b6d4'
  if (mime.startsWith('video/')) return '#ec4899'
  if (mime.startsWith('audio/')) return '#8b5cf6'
  if (mime.includes('zip') || mime.includes('archive')) return '#f59e0b'
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'go', 'rs'].includes(ext || '')) return '#22c55e'
  if (mime.includes('spreadsheet') || ['xlsx', 'xls', 'csv'].includes(ext || '')) return '#16a34a'
  if (mime.includes('presentation') || ['pptx', 'ppt'].includes(ext || '')) return '#ea580c'
  if (mime.includes('pdf') || ext === 'pdf') return '#ef4444'
  if (mime.includes('word') || ['doc', 'docx'].includes(ext || '')) return '#2563eb'

  return '#6b7280'
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen) + '...'
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export const PRIORITY_COLORS = {
  low: { bg: 'rgba(22, 163, 74, 0.1)', text: '#22c55e', border: 'rgba(22, 163, 74, 0.3)' },
  medium: { bg: 'rgba(234, 179, 8, 0.1)', text: '#eab308', border: 'rgba(234, 179, 8, 0.3)' },
  high: { bg: 'rgba(234, 88, 12, 0.1)', text: '#f97316', border: 'rgba(234, 88, 12, 0.3)' },
  urgent: { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' },
}
