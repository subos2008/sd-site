import { callRpc } from '@/lib/rpc'
import {
  ViewNotificationsResult,
  DismissNotificationResult,
  NotificationsUnreadCountResult,
} from '@shared/rpc-contracts'

export const viewNotifications = (cursor: string | null = null) =>
  callRpc('view_notifications', { p_cursor: cursor }, ViewNotificationsResult)

export const dismissNotification = (id: string) =>
  callRpc('dismiss_notification', { p_id: id }, DismissNotificationResult)

export const notificationsUnreadCount = () =>
  callRpc('notifications_unread_count', {}, NotificationsUnreadCountResult)
