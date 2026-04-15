'use server'

import { redirect } from 'next/navigation'

import { signOutAuthenticatedUser } from '@/lib/supabase/auth-server'

export async function signOutAction() {
  await signOutAuthenticatedUser()
  redirect('/')
}
