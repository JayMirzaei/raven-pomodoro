// The sign-in page, used only by a build with sync enabled. On success the
// main process closes this window and opens the widget.
import { readableIpcError } from '../../shared/ipc'

const emailInput = document.getElementById('email') as HTMLInputElement
const passwordInput = document.getElementById('password') as HTMLInputElement
const continueBtn = document.getElementById('continue-btn') as HTMLButtonElement
const errorEl = document.getElementById('error') as HTMLDivElement

function showError(message: string): void {
  errorEl.textContent = message
}

continueBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim()
  const password = passwordInput.value

  if (!email || !password) return showError('Enter both an email and a password.')

  continueBtn.disabled = true
  showError('')
  try {
    await window.raven.signIn(email, password)
  } catch (err) {
    showError(readableIpcError(err, 'Could not sign in.'))
    continueBtn.disabled = false
  }
})

passwordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') continueBtn.click()
})
