/** Copy for send rejection — only the blocker sees Unblock phrasing. */
export function blockedSendErrorMessage(blockReason: 'self' | 'peer' | string | undefined): string {
  return blockReason === 'self'
    ? 'Unblock this contact to send messages'
    : "You can't message this user";
}
