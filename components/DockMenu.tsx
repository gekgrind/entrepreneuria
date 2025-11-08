"use client";

import { useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import Dock from "./Dock";
import {
  HomeIcon,
  Bot,
  CalendarClock,
  ShoppingBag,
  BookOpen,
  BadgeDollarSign,
  Mail,
  Globe
} from "lucide-react";

const ROUTES = {
  home:       { path: "/",             label: "Home",        icon: <HomeIcon size={18} /> },
  prospra:    { path: "/prospra",      label: "Prospra",     icon: <Bot size={18} /> },
  synceri:    { path: "/synceri",      label: "Synceri",     icon: <CalendarClock size={18} /> },
  markets:    { path: "/exchange",     label: "Marketplaces",icon: <ShoppingBag size={18} /> },
  resources:  { path: "/resources",    label: "Resources",   icon: <BookOpen size={18} /> },
  pricing:    { path: "/pricing",      label: "Pricing",     icon: <BadgeDollarSign size={18} /> },
  contact:    { path: "/contact",      label: "Contact",     icon: <Mail size={18} /> },
};

function getItemsForPath(pathname: string) {
  const here =
    pathname === ROUTES.home.path     ? "home" :
    pathname.startsWith(ROUTES.prospra.path)   ? "prospra" :
    pathname.startsWith(ROUTES.synceri.path)   ? "synceri" :
    pathname.startsWith(ROUTES.markets.path)   ? "markets" :
    pathname.startsWith(ROUTES.resources.path) ? "resources" :
    pathname.startsWith(ROUTES.pricing.path)   ? "pricing" :
    pathname.startsWith(ROUTES.contact.path)   ? "contact" :
    "home";

  const pageOrder: Record<string, Array<keyof typeof ROUTES>> = {
    home:     ["prospra", "synceri", "markets", "resources", "pricing", "contact"],
    prospra:  ["home", "synceri", "markets", "resources", "pricing", "contact"],
    synceri:  ["home", "prospra", "markets", "resources", "pricing", "contact"],
    markets:  ["home", "prospra", "synceri", "resources", "pricing", "contact"],
    resources:["home", "prospra", "synceri", "markets", "pricing", "contact"],
    pricing:  ["home", "prospra", "synceri", "markets", "resources", "contact"],
    contact:  ["home", "prospra", "synceri", "markets", "resources", "pricing"],
  };

  return pageOrder[here].map(key => ROUTES[key]);
}

export default function DockMenu() {
  const pathname = usePathname();
  const router = useRouter();

  const items = useMemo(() => {
    const base = getItemsForPath(pathname || "/");
    return base.map(def => ({
      icon: def.icon,
      label: def.label,
      onClick: () => router.push(def.path),
    }));
  }, [pathname, router]);

  return (
    <Dock
      items={items}
      panelHeight={56}
      baseItemSize={42}
      magnification={56}
      distance={140}
      dockHeight={120}
      className="entrepreneuria-dock global-dock"
      spring={{ mass: 0.1, stiffness: 200, damping: 15 }}
    />
  );
}
