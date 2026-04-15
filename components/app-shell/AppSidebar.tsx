import Link from 'next/link'
import { Home, Settings, User } from 'lucide-react'

import { SidebarUserIdentity } from '@/components/account/SidebarUserIdentity'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { UserIdentity } from '@/lib/account/get-resolved-user-identity'

const navigationItems = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/account', label: 'Account', icon: User },
  { href: '/settings', label: 'Settings', icon: Settings },
]

type AppSidebarProps = {
  identity: UserIdentity
}

export function AppSidebar({ identity }: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader className="p-4">
        <Link href="/dashboard" className="text-sm font-semibold">
          Entrepreneuria
        </Link>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent className="p-2">
        <SidebarMenu>
          {navigationItems.map((item) => {
            const Icon = item.icon
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild>
                  <Link href={item.href}>
                    <Icon />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarUserIdentity
          fullName={identity.fullName}
          email={identity.email}
          avatarUrl={identity.avatarUrl}
        />
      </SidebarFooter>
    </Sidebar>
  )
}
