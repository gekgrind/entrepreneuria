'use server'

import { redirect } from 'next/navigation'

import { signOutUser } from '@/lib/supabase/auth-server'

export async function signOutAction() {
  await signOutUser()
  redirect('/')
}
