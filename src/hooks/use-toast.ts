import { useState, useCallback } from 'react'

type ToastProps = {
  title: string
  description?: string
  variant?: 'default' | 'destructive'
}

type Toast = ToastProps & {
  id: string
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((props: ToastProps) => {
    const id = Math.random().toString(36).substring(7)
    const newToast: Toast = { ...props, id }

    setToasts((prev) => [...prev, newToast])

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)

    // For now, use alert as fallback
    if (props.variant === 'destructive') {
      alert(`❌ ${props.title}\n${props.description || ''}`)
    } else {
      alert(`✓ ${props.title}\n${props.description || ''}`)
    }
  }, [])

  return { toast, toasts }
}
