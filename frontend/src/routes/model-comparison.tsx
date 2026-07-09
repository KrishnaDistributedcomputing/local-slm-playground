import { createFileRoute } from '@tanstack/react-router';
import { NotificationPlatform } from './apps/notifications';

export const Route = createFileRoute('/model-comparison')({
  component: NotificationPlatform,
});