import { createFileRoute } from '@tanstack/react-router';
import { AzureServices } from './apps/azure-services';

export const Route = createFileRoute('/azure-services')({
  component: AzureServices,
});