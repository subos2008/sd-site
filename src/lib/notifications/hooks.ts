import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { viewNotifications, dismissNotification, notificationsUnreadCount } from './api'

const POLL_MS = 30_000

export function useNotificationsPoll() {
  return useQuery({
    queryKey: ['notifications', 'recent'],
    queryFn: () => viewNotifications(null),
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: notificationsUnreadCount,
    refetchInterval: POLL_MS,
    refetchOnWindowFocus: true,
  })
}

export function useDismissNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: dismissNotification,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
