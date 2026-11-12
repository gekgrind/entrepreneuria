"use client";

import { useEffect, useState } from "react";

/**
 * Follows the global Header's `data-visible` / `data-menu-open` attributes
 * (components/Header.tsx) so page chrome can tuck under it or step aside.
 */
export function useSiteHeaderState() {
  const [state, setState] = useState({ visible: true, menuOpen: false });

  useEffect(() => {
    const header = document.querySelector<HTMLElement>("[data-site-header]");
    if (!header) return;
    const read = () =>
      setState({
        visible: header.dataset.visible !== "false",
        menuOpen: header.dataset.menuOpen === "true",
      });
    read();
    const mo = new MutationObserver(read);
    mo.observe(header, { attributes: true, attributeFilter: ["data-visible", "data-menu-open"] });
    return () => mo.disconnect();
  }, []);

  return state;
}
