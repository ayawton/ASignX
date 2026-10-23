import { internalPath } from './auth-path.js'

export function confirmationRedirect(origin, next) {
 return `${new URL(origin).origin}/auth/callback?next=${encodeURIComponent(internalPath(next))}`
}

export async function resendConfirmation(client, email, origin, next) {
 const address = typeof email === 'string' ? email.trim() : ''
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error('Enter a valid email address.')
 if (!client) throw new Error('Confirmation emails are temporarily unavailable. Please try again later.')
 const { error } = await client.auth.resend({ type: 'signup', email: address, options: { emailRedirectTo: confirmationRedirect(origin, next) } })
 if (error) throw error
}

// An old browser session is never evidence that the link just opened was valid.
export async function confirmEmail(client, callbackUrl) {
 const url = new URL(callbackUrl)
 const fragment = new URLSearchParams(url.hash.slice(1))
 if (url.searchParams.has('error') || fragment.has('error') || url.searchParams.has('error_code') || fragment.has('error_code')) throw new Error('This confirmation link has expired or is invalid. Request a new email below.')
 if (!client) throw new Error('Email confirmation is temporarily unavailable. Please try again later.')
 let result
 if (url.searchParams.has('code')) {
  result = await client.auth.exchangeCodeForSession(url.searchParams.get('code'))
 } else if (url.searchParams.has('token_hash') && ['signup', 'email'].includes(url.searchParams.get('type'))) {
  result = await client.auth.verifyOtp({ token_hash: url.searchParams.get('token_hash'), type: url.searchParams.get('type') })
 } else if (fragment.get('access_token') && fragment.get('refresh_token') && (!fragment.get('type') || fragment.get('type') === 'signup')) {
  result = await client.auth.setSession({ access_token: fragment.get('access_token'), refresh_token: fragment.get('refresh_token') })
 } else throw new Error('Open the confirmation link from your email, or request a new one below.')
 if (result.error) throw new Error('This confirmation link could not be verified. It may have expired or already been used. Request a new email below.')
 if (!result.data?.session?.access_token) throw new Error('Confirmation did not create a session. Please log in or request a new email.')
 const { data, error } = await client.auth.getUser(result.data.session.access_token)
 if (error || !data.user?.email_confirmed_at) throw new Error('Your email has not been confirmed. Request a new confirmation email.')
 return data.user
}
