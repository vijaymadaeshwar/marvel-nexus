// notifications.ts — PWA Push Notification system for Marvel Nexus

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
}

// Check if notifications are supported and permitted
export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

export function getPermission(): NotificationPermission {
  if (!('Notification' in window)) return 'denied';
  return Notification.permission;
}

// Show a local notification (works without push server)
export async function showNotification(payload: NotificationPayload): Promise<void> {
  const permission = await requestPermission();
  if (permission !== 'granted') return;
  
  const reg = await navigator.serviceWorker?.ready;
  if (reg?.showNotification) {
    await reg.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/assets/favicon-48.png',
      badge: payload.badge || '/assets/favicon-48.png',
      tag: payload.tag || 'marvel-nexus',
      data: payload.data || {},
    });
  } else {
    new Notification(payload.title, {
      body: payload.body,
      icon: payload.icon || '/assets/favicon-48.png',
    });
  }
}

// Notification presets
export const NOTIFICATIONS = {
  newTitle: (title: string): NotificationPayload => ({
    title: 'New Marvel Title Available!',
    body: `${title} is now streaming. Open Marvel Nexus to update your timeline.`,
    tag: `new-title-${title.toLowerCase().replace(/\s+/g, '-')}`,
  }),
  
  watchReminder: (title: string, days: number): NotificationPayload => ({
    title: 'Time to Watch!',
    body: `You added "${title}" to your watchlist ${days} day${days !== 1 ? 's' : ''} ago. Ready to watch?`,
    tag: `watch-reminder-${title.toLowerCase().replace(/\s+/g, '-')}`,
  }),
  
  achievementUnlocked: (name: string): NotificationPayload => ({
    title: 'Achievement Unlocked!',
    body: `You earned "${name}". Keep exploring the multiverse!`,
    tag: `achievement-${name.toLowerCase().replace(/\s+/g, '-')}`,
  }),
  
  doomsdayCountdown: (days: number): NotificationPayload => ({
    title: 'Avengers: Doomsday',
    body: `Only ${days} days until Doomsday! ${days <= 30 ? 'Time to catch up!' : 'Plan your watch journey now.'}`,
    tag: 'doomsday-countdown',
  }),
  
  weeklyDigest: (watched: number, total: number): NotificationPayload => ({
    title: 'Your Weekly Marvel Digest',
    body: `You watched ${watched} title${watched !== 1 ? 's' : ''} this week. ${total} of 136 titles completed.`,
    tag: 'weekly-digest',
  }),
};

// Schedule periodic checks (call on app load)
export function scheduleNotifications(): void {
  if (getPermission() !== 'granted') return;
  
  // Doomsday countdown
  const doomsday = new Date('2026-12-18');
  const now = new Date();
  const daysUntil = Math.ceil((doomsday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysUntil > 0 && daysUntil <= 120) {
    const lastNotified = localStorage.getItem('marvel-nexus-last-doomsday-notif');
    const today = now.toDateString();
    if (lastNotified !== today && daysUntil % 7 === 0) {
      showNotification(NOTIFICATIONS.doomsdayCountdown(daysUntil));
      localStorage.setItem('marvel-nexus-last-doomsday-notif', today);
    }
  }
}

// Initialize notification system
export function initNotifications(): void {
  requestPermission();
  scheduleNotifications();
}
