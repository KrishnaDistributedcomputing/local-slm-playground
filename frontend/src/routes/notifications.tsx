import { createFileRoute } from '@tanstack/react-router';
import { NotificationPlatform } from './apps/notifications';

export const Route = createFileRoute('/notifications')({
  component: NotificationPlatform,
});