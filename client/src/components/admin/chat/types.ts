/**
 * Normalized chat message for the admin chat components (staff messages,
 * customer service). Pages map their API rows into this shape so the thread
 * renders the same everywhere.
 */
export interface AdminChatMessage {
  id: string | number;
  content: string;
  /** ISO timestamp. */
  time: string | null;
  senderId?: string | number | null;
  senderName?: string;
  /** Sent by the current side (you / staff): right-aligned, brand-tinted. */
  own: boolean;
  /** Centered system note instead of a bubble. */
  system?: boolean;
}
