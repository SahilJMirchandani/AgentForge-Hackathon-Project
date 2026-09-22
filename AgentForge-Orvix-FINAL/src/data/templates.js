// Each template mirrors the visual language from the design mockup:
// Trigger (blue) -> Action (green) -> AI Agent (purple) -> Condition (orange) -> Action/Output (pink)

const emailAutomation = {
  name: 'Email Automation Agent',
  nodes: [
    { id: 'n1', type: 'workflow', position: { x: 40, y: 140 }, data: { kind: 'trigger', icon: 'Mail', title: 'Gmail Inbox Trigger', subtitle: 'When unread email is available', instructions: 'Read unread email messages from the connected Gmail inbox.' } },
    { id: 'n2', type: 'workflow', position: { x: 320, y: 140 }, data: { kind: 'action', icon: 'Inbox', title: 'Prepare Inbox', subtitle: 'Prepare unread messages', instructions: 'Prepare the unread Gmail messages for analysis.' } },
    { id: 'n3', type: 'workflow', position: { x: 600, y: 140 }, data: { kind: 'ai', icon: 'Sparkles', title: 'AI Summarizer', subtitle: 'Summarize & find important', instructions: 'Summarize the email and identify important messages.' } },
    { id: 'n4', type: 'workflow', position: { x: 880, y: 140 }, data: { kind: 'condition', icon: 'AlertTriangle', title: 'Urgency Check', subtitle: 'Is it urgent?', instructions: 'Continue when at least one new email is available so every new email can be summarized and notified.' } },
    { id: 'n5', type: 'workflow', position: { x: 700, y: 320 }, data: { kind: 'action', icon: 'CheckSquare', title: 'Create Task', subtitle: 'Add to task list', instructions: 'Create a task for each important item.' } },
    { id: 'n6', type: 'workflow', position: { x: 980, y: 320 }, data: { kind: 'output', icon: 'Bell', title: 'Notify User', subtitle: 'Send notification', instructions: 'Send a notification to the user.', destination: '' } },
  ],
  edges: [
    { id: 'e1-2', source: 'n1', target: 'n2', animated: false },
    { id: 'e2-3', source: 'n2', target: 'n3', animated: false },
    { id: 'e3-4', source: 'n3', target: 'n4', animated: false },
    { id: 'e4-5', source: 'n4', target: 'n5', animated: false },
    { id: 'e5-6', source: 'n5', target: 'n6', animated: false },
  ],
  logSteps: [
    'Email input received',
    'Email content prepared',
    '4 important messages identified',
    '2 urgent items detected',
    '2 tasks created',
    'Notification sent',
  ],
  results: [
    { label: 'Important Emails Found', value: 4, icon: 'Mail' },
    { label: 'Urgent Items', value: 2, icon: 'AlertTriangle' },
    { label: 'Tasks Created', value: 2, icon: 'CheckSquare' },
  ],
}

const feedbackAnalyzer = {
  name: 'Customer Feedback Analyzer',
  nodes: [
    { id: 'n1', type: 'workflow', position: { x: 40, y: 140 }, data: { kind: 'trigger', icon: 'MessageSquare', title: 'Form Trigger', subtitle: 'When feedback submitted', instructions: 'When new feedback is submitted.' } },
    { id: 'n2', type: 'workflow', position: { x: 320, y: 140 }, data: { kind: 'action', icon: 'Database', title: 'Collect Responses', subtitle: 'Pull from feedback form', instructions: 'Collect responses from the feedback form.' } },
    { id: 'n3', type: 'workflow', position: { x: 600, y: 140 }, data: { kind: 'ai', icon: 'Sparkles', title: 'Sentiment Analysis', subtitle: 'Classify tone & topic', instructions: 'Classify the feedback tone and topic.' } },
    { id: 'n4', type: 'workflow', position: { x: 880, y: 140 }, data: { kind: 'condition', icon: 'AlertTriangle', title: 'Negative Check', subtitle: 'Is sentiment negative?', instructions: 'Continue when sentiment is negative.' } },
    { id: 'n5', type: 'workflow', position: { x: 700, y: 320 }, data: { kind: 'action', icon: 'CheckSquare', title: 'Create Ticket', subtitle: 'Flag for follow-up', instructions: 'Create a ticket for critical feedback.' } },
    { id: 'n6', type: 'workflow', position: { x: 980, y: 320 }, data: { kind: 'output', icon: 'Bell', title: 'Notify Team', subtitle: 'Send Slack alert', instructions: 'Send an alert to the team.', destination: '' } },
  ],
  edges: [
    { id: 'e1-2', source: 'n1', target: 'n2' },
    { id: 'e2-3', source: 'n2', target: 'n3' },
    { id: 'e3-4', source: 'n3', target: 'n4' },
    { id: 'e4-5', source: 'n4', target: 'n5' },
    { id: 'e5-6', source: 'n5', target: 'n6' },
  ],
  logSteps: [
    'Feedback form connected',
    '28 responses collected',
    '9 negative responses found',
    '3 flagged as critical',
    '3 tickets created',
    'Team notified on Slack',
  ],
  results: [
    { label: 'Responses Analyzed', value: 28, icon: 'MessageSquare' },
    { label: 'Negative Flagged', value: 9, icon: 'AlertTriangle' },
    { label: 'Tickets Created', value: 3, icon: 'CheckSquare' },
  ],
}

const salesMonitor = {
  name: 'Sales Monitor',
  nodes: [
    { id: 'n1', type: 'workflow', position: { x: 40, y: 140 }, data: { kind: 'trigger', icon: 'Clock', title: 'Schedule Trigger', subtitle: 'Every day at 9 AM', instructions: 'Run every day at 9 AM.' } },
    { id: 'n2', type: 'workflow', position: { x: 320, y: 140 }, data: { kind: 'action', icon: 'TrendingUp', title: 'Fetch Sales Data', subtitle: 'Pull from CRM', instructions: 'Fetch sales data from the CRM.' } },
    { id: 'n3', type: 'workflow', position: { x: 600, y: 140 }, data: { kind: 'ai', icon: 'Sparkles', title: 'Trend Analysis', subtitle: 'Compare vs target', instructions: 'Compare sales trends against the target.' } },
    { id: 'n4', type: 'workflow', position: { x: 880, y: 140 }, data: { kind: 'condition', icon: 'AlertTriangle', title: 'Below Target?', subtitle: 'Check threshold', instructions: 'Continue when sales are below target.' } },
    { id: 'n5', type: 'workflow', position: { x: 980, y: 320 }, data: { kind: 'output', icon: 'Bell', title: 'Notify User', subtitle: 'Send summary email', instructions: 'Send a summary of the sales results.', destination: '' } },
  ],
  edges: [
    { id: 'e1-2', source: 'n1', target: 'n2' },
    { id: 'e2-3', source: 'n2', target: 'n3' },
    { id: 'e3-4', source: 'n3', target: 'n4' },
    { id: 'e4-5', source: 'n4', target: 'n5' },
  ],
  logSteps: [
    'CRM connected',
    'Sales data fetched for 24 accounts',
    'Trend computed vs monthly target',
    '1 region below target',
    'Summary email sent',
  ],
  results: [
    { label: 'Accounts Checked', value: 24, icon: 'TrendingUp' },
    { label: 'Below Target', value: 1, icon: 'AlertTriangle' },
    { label: 'Reports Sent', value: 1, icon: 'Bell' },
  ],
}

const meetingFollowUp = {
  name: 'Meeting Follow-up Agent',
  nodes: [
    { id: 'n1', type: 'workflow', position: { x: 40, y: 140 }, data: { kind: 'trigger', icon: 'Calendar', title: 'Calendar Trigger', subtitle: 'When meeting ends', instructions: 'When a meeting ends.' } },
    { id: 'n2', type: 'workflow', position: { x: 320, y: 140 }, data: { kind: 'action', icon: 'Inbox', title: 'Fetch Transcript', subtitle: 'Get meeting notes', instructions: 'Fetch the meeting transcript.' } },
    { id: 'n3', type: 'workflow', position: { x: 600, y: 140 }, data: { kind: 'ai', icon: 'Sparkles', title: 'AI Summarizer', subtitle: 'Extract action items', instructions: 'Extract decisions and action items.' } },
    { id: 'n4', type: 'workflow', position: { x: 880, y: 140 }, data: { kind: 'action', icon: 'CheckSquare', title: 'Create Tasks', subtitle: 'One per action item', instructions: 'Create one task for each action item.' } },
    { id: 'n5', type: 'workflow', position: { x: 1140, y: 140 }, data: { kind: 'output', icon: 'Bell', title: 'Notify Attendees', subtitle: 'Send recap email', instructions: 'Send a recap to the attendees.', destination: '' } },
  ],
  edges: [
    { id: 'e1-2', source: 'n1', target: 'n2' },
    { id: 'e2-3', source: 'n2', target: 'n3' },
    { id: 'e3-4', source: 'n3', target: 'n4' },
    { id: 'e4-5', source: 'n4', target: 'n5' },
  ],
  logSteps: [
    'Calendar connected',
    'Transcript fetched',
    '6 action items extracted',
    '6 tasks created',
    'Recap email sent to 5 attendees',
  ],
  results: [
    { label: 'Action Items Found', value: 6, icon: 'Sparkles' },
    { label: 'Tasks Created', value: 6, icon: 'CheckSquare' },
    { label: 'Attendees Notified', value: 5, icon: 'Bell' },
  ],
}

export const TEMPLATES = {
  email: emailAutomation,
  feedback: feedbackAnalyzer,
  sales: salesMonitor,
  meeting: meetingFollowUp,
}

export const TEMPLATE_LIST = [
  { key: 'email', name: 'Email Summarizer', description: 'Process email content, summarize important messages, and create tasks.', color: 'primary' },
  { key: 'feedback', name: 'Customer Feedback Analyzer', description: 'Analyze customer feedback and create tasks for negative feedback.', color: 'secondary' },
  { key: 'sales', name: 'Sales Monitor', description: 'Track sales data, find trends and notify you of important changes.', color: 'success' },
  { key: 'meeting', name: 'Meeting Follow-up Agent', description: 'Summarize meetings and create action items.', color: 'accent' },
]

// Very small "keyword classifier" standing in for the real Gemini call.
// Returns a template key, or null when nothing matches (drives the error state).
export function classifyPrompt(prompt) {
  const p = prompt.trim().toLowerCase()
  if (p.length < 8) return null
  if (p.includes('email') || p.includes('inbox') || p.includes('gmail')) return 'email'
  if (p.includes('feedback') || p.includes('review') || p.includes('sentiment')) return 'feedback'
  if (p.includes('sales') || p.includes('revenue') || p.includes('crm')) return 'sales'
  if (p.includes('meeting') || p.includes('call') || p.includes('transcript')) return 'meeting'
  // Unrecognized but long enough prompt: still fall back to email template
  // half the time to feel "alive", otherwise trigger the error state.
  if (p.includes('trigger') || p.includes('workflow') || p.includes('automat') || p.includes('agent')) return 'email'
  return null
}

// Notification channel + recipient are resolved by the shared helpers in
// src/utils/notify.js so the editor, the template cloner and the executor all
// agree on what a valid destination looks like.
export { resolveChannel as classifyNotificationChannel, extractDestinationFromPrompt } from '../utils/notify.js'
