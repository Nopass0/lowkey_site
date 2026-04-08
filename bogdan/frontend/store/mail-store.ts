import { create } from 'zustand'

export interface MailAccount {
  id: string
  email: string
  name: string
  avatar?: string
  unread: number
  color: string
}

export interface MailMessage {
  id: string
  accountId: string
  from: { name: string; email: string }
  to: { name: string; email: string }[]
  cc?: { name: string; email: string }[]
  subject: string
  body: string
  bodyHtml?: string
  date: string
  read: boolean
  starred: boolean
  folder: 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | string
  labels?: string[]
  attachments?: { name: string; size: number; type: string; url: string }[]
}

export type MailFolder = 'inbox' | 'sent' | 'drafts' | 'trash' | 'spam' | 'starred'

interface MailState {
  accounts: MailAccount[]
  messages: MailMessage[]
  selectedAccount: string | null
  selectedMessage: string | null
  selectedFolder: MailFolder
  searchQuery: string
  composeOpen: boolean
  loading: boolean
  setSelectedAccount: (id: string | null) => void
  setSelectedMessage: (id: string | null) => void
  setSelectedFolder: (folder: MailFolder) => void
  setSearchQuery: (q: string) => void
  setComposeOpen: (open: boolean) => void
  markRead: (id: string) => void
  toggleStar: (id: string) => void
  moveToTrash: (id: string) => void
  addMessage: (msg: MailMessage) => void
  setAccounts: (accounts: MailAccount[]) => void
  setMessages: (messages: MailMessage[]) => void
  setLoading: (loading: boolean) => void
}

const demoAccounts: MailAccount[] = [
  { id: '1', email: 'bogdan@lowkey.su', name: 'Bogdan', unread: 3, color: '#7c3aed' },
  { id: '2', email: 'bogdan@gmail.com', name: 'Bogdan (Gmail)', unread: 7, color: '#2563eb' },
]

const demoMessages: MailMessage[] = [
  {
    id: '1', accountId: '1',
    from: { name: 'Alice Johnson', email: 'alice@example.com' },
    to: [{ name: 'Bogdan', email: 'bogdan@lowkey.su' }],
    subject: 'Project Update - Q4 2024',
    body: `Hi Bogdan,

I wanted to give you an update on the project progress. We've completed the first phase and are moving into the testing stage.

Key highlights:
- Feature A is fully implemented
- Performance improvements of 40%
- Security audit passed

Let me know if you have any questions.

Best regards,
Alice`,
    date: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    read: false, starred: true, folder: 'inbox',
    labels: ['work', 'important'],
  },
  {
    id: '2', accountId: '1',
    from: { name: 'GitHub', email: 'noreply@github.com' },
    to: [{ name: 'Bogdan', email: 'bogdan@lowkey.su' }],
    subject: '[lowkey/web] Pull request opened by contributor',
    body: `A new pull request has been opened on lowkey/web:

#42 - Add dark mode support
Opened by: dev_user

Review the PR at: https://github.com/lowkey/web/pull/42`,
    date: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    read: false, starred: false, folder: 'inbox',
    labels: ['github'],
  },
  {
    id: '3', accountId: '1',
    from: { name: 'Stripe', email: 'receipts@stripe.com' },
    to: [{ name: 'Bogdan', email: 'bogdan@lowkey.su' }],
    subject: 'Your payment receipt from Stripe',
    body: `Thank you for your payment. Here is your receipt for $49.00.`,
    date: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    read: true, starred: false, folder: 'inbox',
    labels: ['finance'],
  },
  {
    id: '4', accountId: '2',
    from: { name: 'Bob Smith', email: 'bob@company.com' },
    to: [{ name: 'Bogdan', email: 'bogdan@gmail.com' }],
    subject: 'Meeting tomorrow at 3PM',
    body: `Hi, just confirming our meeting tomorrow at 3PM. Please bring the latest reports.`,
    date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    read: false, starred: false, folder: 'inbox',
  },
  {
    id: '5', accountId: '1',
    from: { name: 'Bogdan', email: 'bogdan@lowkey.su' },
    to: [{ name: 'Team', email: 'team@company.com' }],
    subject: 'Weekly Status Report',
    body: `Hey team, here is the weekly status update...`,
    date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    read: true, starred: false, folder: 'sent',
  },
]

export const useMailStore = create<MailState>((set, get) => ({
  accounts: demoAccounts,
  messages: demoMessages,
  selectedAccount: null,
  selectedMessage: null,
  selectedFolder: 'inbox',
  searchQuery: '',
  composeOpen: false,
  loading: false,
  setSelectedAccount: (id) => set({ selectedAccount: id, selectedMessage: null }),
  setSelectedMessage: (id) => {
    set({ selectedMessage: id })
    if (id) {
      set(state => ({
        messages: state.messages.map(m => m.id === id ? { ...m, read: true } : m),
        accounts: state.accounts.map(a => {
          const msg = state.messages.find(m => m.id === id)
          if (msg && !msg.read && a.id === msg.accountId) {
            return { ...a, unread: Math.max(0, a.unread - 1) }
          }
          return a
        }),
      }))
    }
  },
  setSelectedFolder: (folder) => set({ selectedFolder: folder, selectedMessage: null }),
  setSearchQuery: (q) => set({ searchQuery: q }),
  setComposeOpen: (open) => set({ composeOpen: open }),
  markRead: (id) => set(state => ({
    messages: state.messages.map(m => m.id === id ? { ...m, read: true } : m),
  })),
  toggleStar: (id) => set(state => ({
    messages: state.messages.map(m => m.id === id ? { ...m, starred: !m.starred } : m),
  })),
  moveToTrash: (id) => set(state => ({
    messages: state.messages.map(m => m.id === id ? { ...m, folder: 'trash' } : m),
  })),
  addMessage: (msg) => set(state => ({ messages: [msg, ...state.messages] })),
  setAccounts: (accounts) => set({ accounts }),
  setMessages: (messages) => set({ messages }),
  setLoading: (loading) => set({ loading }),
}))
