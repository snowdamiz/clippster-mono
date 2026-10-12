/**
 * Chat pieces for admin messenger pages (Staff messages, Customer service).
 * Bubbles and the composer are the shared messaging components
 * (components/messaging/MessageBubble with `readonly`, MessageComposer with
 * `hide-attach send-on-enter centered`), since the admin chat APIs have no
 * edit/delete/attachments.
 *
 * - AdminChatHeader   avatar + title + subtitle + actions row
 * - AdminChatThread   day dividers + grouped read-only bubbles (inside the page's scroller);
 *                     `loading` draws placeholder bubbles until the first messages arrive
 * - AdminChatListSkeleton  first-load placeholder rows for the conversation list
 */
export { default as AdminChatHeader } from './AdminChatHeader.vue';
export { default as AdminChatThread } from './AdminChatThread.vue';
export { default as AdminChatListSkeleton } from './AdminChatListSkeleton.vue';
export type { AdminChatMessage } from './types';
