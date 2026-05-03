import { ReactNode } from 'react'

import { AppSidebar } from '@/components/app-shell/AppSidebar'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import type { ResolvedUserIdentity } from '@/lib/account/get-resolved-user-identity'

type AppShellProps = {
  identity: ResolvedUserIdentity
  children: ReactNode
}

export function AppShell({ identity, children }: AppShellProps) {
  return (
    <SidebarProvider>
      <AppSidebar identity={identity} />
      <SidebarInset>
        <main className="min-h-svh p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
