const hoursAgo = (hours) => Date.now() - hours * 60 * 60 * 1000

export const DEMO_INBOX_MESSAGES = [
  {
    id: 'demo-email-001',
    internalDate: hoursAgo(1.2),
    snippet: 'The client approved the revised dashboard scope. Please prepare the final task list before Friday.',
    body: 'Hi team,\n\nThe client has approved the revised dashboard scope. Please prepare the final task list before Friday so we can start implementation next week.\n\nThanks,\nPriya',
    headers: [
      { name: 'From', value: 'Priya Shah <priya@example.com>' },
      { name: 'Subject', value: 'Dashboard scope approved' },
      { name: 'Date', value: 'Today, 12:30 PM' },
    ],
  },
  {
    id: 'demo-email-002',
    internalDate: hoursAgo(2.5),
    snippet: 'The production deployment is healthy, but the API latency is above the target on the reporting endpoint.',
    body: 'Hello,\n\nThe latest deployment is healthy overall. However, the reporting endpoint is averaging 850 ms, which is above our 500 ms target. Please investigate before the next release.\n\nRegards,\nArjun',
    headers: [
      { name: 'From', value: 'Arjun Mehta <arjun@example.com>' },
      { name: 'Subject', value: 'Action needed: reporting API latency' },
      { name: 'Date', value: 'Today, 11:10 AM' },
    ],
  },
  {
    id: 'demo-email-003',
    internalDate: hoursAgo(4),
    snippet: 'Reminder: the project presentation is scheduled for Friday at 10:00 AM. Please bring the final live demo.',
    body: 'Hi everyone,\n\nThis is a reminder that the project presentation is scheduled for Friday at 10:00 AM. Please bring the final live demo and make sure the deployment is working before the session.\n\nBest,\nProject Coordinator',
    headers: [
      { name: 'From', value: 'Project Coordinator <coordinator@example.com>' },
      { name: 'Subject', value: 'Project presentation reminder' },
      { name: 'Date', value: 'Today, 9:30 AM' },
    ],
  },
]

export function fetchDemoInboxMessages({ limit = 20 } = {}) {
  const messages = DEMO_INBOX_MESSAGES
    .sort((a, b) => Number(b.internalDate) - Number(a.internalDate))
    .slice(0, limit)

  return messages
}
