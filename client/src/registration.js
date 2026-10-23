import { confirmationRedirect } from './confirmation.js'

// Confirmation passwords and prototype browser records never leave this form.
export async function registerAccount(client, values, origin, next) {
 const name = typeof values.name === 'string' ? values.name.trim() : ''
 const email = typeof values.email === 'string' ? values.email.trim() : ''
 if (!name || name.length > 100) throw new Error('Enter a display name between 1 and 100 characters.')
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.')
 if (typeof values.password !== 'string' || values.password.length < 8) throw new Error('Use a password with at least 8 characters.')
 if (values.password !== values.confirmPassword) throw new Error('Your passwords do not match.')
 if (!client) throw new Error('Registration is temporarily unavailable. Please try again later.')
 const { data, error } = await client.auth.signUp({
  email,
  password: values.password,
  options: {
   data: { display_name: name },
   emailRedirectTo: confirmationRedirect(origin, next),
  },
 })
 if (error) throw error
 if (!data?.user) throw new Error('We could not complete registration. Please try again.')
 return data
}
