export const statusOptions = [
  { label: 'All Status', value: 'all' },
  { label: 'Live Now', value: 'live' },
  { label: 'Has Clips', value: 'has_clips' },
];
export const sortOptions = [
  { label: 'Updated: Newest', value: 'updated-desc' },
  { label: 'Updated: Oldest', value: 'updated-asc' },
  { label: 'Created: Newest', value: 'created-desc' },
  { label: 'Created: Oldest', value: 'created-asc' },
  { label: 'Name: A-Z', value: 'name-asc' },
  { label: 'Name: Z-A', value: 'name-desc' },
];
import { toDate, formatDate } from '@/utils/dateTimeUtils';
export function getDateLabel(timestamp: number): string {
  const date = toDate(timestamp);
  if (isNaN(date.getTime())) return 'Unknown';
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const day = new Date(date); day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return 'Today';
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  return day.getTime() === yesterday.getTime() ? 'Yesterday' : formatDate(date);
}
