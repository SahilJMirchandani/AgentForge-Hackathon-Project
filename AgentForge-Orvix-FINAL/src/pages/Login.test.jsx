import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Login from './Login'
import Topbar from '../components/Topbar'
import { useAppStore } from '../store/useAppStore'

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Login />
    </MemoryRouter>
  )
}

describe('Login page auth actions', () => {
  beforeEach(() => {
    localStorage.clear()
    useAppStore.setState({
      isAuthenticated: false,
      userName: 'User',
      userEmail: '',
      currentUserId: '',
      users: {},
      workflows: [],
      notifications: [{ id: 'welcome', title: 'Welcome back', message: 'Your workspace is ready.', read: false }],
      isNotificationsOpen: false,
      lastError: null,
    })
  })

  it('opens the forgot password flow when the button is clicked', () => {
    renderLogin()

    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }))

    expect(screen.getByText(/reset your password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument()
  })

  it('opens the sign up flow when the button is clicked', () => {
    renderLogin()

    fireEvent.click(screen.getByRole('button', { name: /sign up/i }))

    expect(screen.getByText(/create your account/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
  })

  it('opens the notifications panel when the bell is clicked', () => {
    render(
      <MemoryRouter>
        <Topbar userName="Ada" />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByRole('button', { name: /notifications/i }))

    expect(screen.getByText(/welcome back/i)).toBeInTheDocument()
  })

  it('restores saved workflows after logout and login with the same email', () => {
    useAppStore.getState().signup('Ada Lovelace', 'ada@example.com', 'secret-pass')
    useAppStore.getState().generateWorkflow('Create a lead capture workflow')
    useAppStore.getState().logout()
    useAppStore.getState().login('ada@example.com', 'secret-pass')

    expect(useAppStore.getState().userEmail).toBe('ada@example.com')
    expect(useAppStore.getState().workflows).toHaveLength(1)
  })

  it('remembers a user and deletes a workflow from the saved account', () => {
    useAppStore.getState().signup('Ada Lovelace', 'ada@example.com', 'secret-pass')
    const workflowId = useAppStore.getState().generateWorkflow('Create a lead capture workflow')

    expect(workflowId).toBeTruthy()
    expect(useAppStore.getState().workflows).toHaveLength(1)

    useAppStore.getState().deleteWorkflow(workflowId)
    expect(useAppStore.getState().workflows).toHaveLength(0)
  })

  it('clears the saved session when the user logs out', () => {
    useAppStore.getState().signup('Ada Lovelace', 'ada@example.com', 'secret-pass')
    localStorage.setItem('agentforge-session-v1', JSON.stringify({
      email: 'ada@example.com',
      password: 'secret-pass',
      rememberMe: true,
      name: 'Ada Lovelace',
    }))

    useAppStore.getState().logout()

    expect(useAppStore.getState().isAuthenticated).toBe(false)
    expect(JSON.parse(localStorage.getItem('agentforge-session-v1') || 'null')).toBeNull()
  })
})
