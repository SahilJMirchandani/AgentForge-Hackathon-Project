const hoursAgo = (hours) => Date.now() - hours * 60 * 60 * 1000

// Fixed, role-based sample messages keep the presentation realistic and consistent.
// The content is fictional demo data and does not use real people's identities.
export const DEMO_INBOX_MESSAGES = [
  {
    id: 'demo-email-001',
    internalDate: hoursAgo(1.2),
    snippet: 'The revised dashboard scope has been approved. Implementation can begin next week.',
    body: 'Hi team,\n\nThe revised dashboard scope has been approved. Implementation can begin next week. Please refer to the approved scope for planning.\n\nThanks,\nProject Management',
    headers: [
      { name: 'From', value: 'Project Management <project-management@example.com>' },
      { name: 'Subject', value: 'Dashboard scope approved — next steps' },
      { name: 'Date', value: 'Today, 12:30 PM' },
    ],
  },
  {
    id: 'demo-email-002',
    internalDate: hoursAgo(2.5),
    snippet: 'The reporting API is averaging 850 ms against a 500 ms target. Please investigate before the next release.',
    body: 'Hello team,\n\nThe latest deployment is healthy overall, but the reporting API is averaging 850 ms against the 500 ms response-time target. Please investigate the regression before the next release.\n\nRegards,\nPlatform Engineering',
    headers: [
      { name: 'From', value: 'Platform Engineering <platform-engineering@example.com>' },
      { name: 'Subject', value: 'Action required — reporting API latency' },
      { name: 'Date', value: 'Today, 11:10 AM' },
    ],
  },
  {
    id: 'demo-email-003',
    internalDate: hoursAgo(4),
    snippet: 'The project presentation is scheduled for Friday at 10:00 AM. Please bring the final live demo and verify the deployment.',
    body: 'Hi everyone,\n\nThe project presentation is scheduled for Friday at 10:00 AM. Please bring the final live demo and verify that the deployed application is working before the session.\n\nBest,\nProject Coordination',
    headers: [
      { name: 'From', value: 'Project Coordination <project-coordination@example.com>' },
      { name: 'Subject', value: 'Project presentation — final checklist' },
      { name: 'Date', value: 'Today, 9:30 AM' },
    ],
  },
]

export function fetchDemoInboxMessages({ limit = 20 } = {}) {
  return DEMO_INBOX_MESSAGES
    .slice()
    .sort((a, b) => Number(b.internalDate) - Number(a.internalDate))
    .slice(0, limit)
}
