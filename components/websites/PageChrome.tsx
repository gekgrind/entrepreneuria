"use client";

import { useEffect, useState, type MouseEvent, type ReactNode } from "react";

import { useSelection, type PackageChoice } from "./SelectionContext";
import { useSiteHeaderState } from "./useSiteHeaderState";
import s from "./websites.module.css";

const SECTIONS = [
  { id: "examples", label: "Examples" },
  { id: "why", label: "Why a website" },
  { id: "packages", label: "Packages" },
  { id: "how", label: "How it works" },
  { id: "faq", label: "FAQ" },
] as const;

/** Desktop-only second sticky row under the global Header. */
export function PageSubnav() {
  const { visible } = useSiteHeaderState();
  const [current, setCurrent] = useState<string | null>(null);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => en.isIntersecting && setCurrent(en.target.id)),
      { rootMargin: "-45% 0px -50% 0px" }
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, []);

  return (
    <nav className={s.subnav} aria-label="Page sections" data-header-hidden={visible ? "false" : "true"}>
      <div className={`${s.wrap} ${s.subRow}`}>
        <span className={s.subTitle}>Websites</span>
        {SECTIONS.map(({ id, label }) => (
          <a key={id} className={s.subLink} href={`#${id}`} aria-current={current === id ? "true" : undefined}>
            {label}
          </a>
        ))}
        <a className={`${s.btn} ${s.btnPrimary}`} href="#preview">
          Free preview
        </a>
      </div>
    </nav>
  );
}

/**
 * Phone-only fixed CTA. Hidden at 760px and up (CSS), over the hero, the
 * form and the footer, and while the global mobile menu is open.
 */
export function MobileDock({ priceLabel }: { priceLabel: string }) {
  const { menuOpen } = useSiteHeaderState();
  const [inView, setInView] = useState({ hero: true, form: false, foot: false });

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const watch: Array<[string, keyof typeof inView]> = [
      ["#top", "hero"],
      ["#preview", "form"],
      ["footer", "foot"],
    ];
    const observers = watch.flatMap(([sel, key]) => {
      const el = document.querySelector(sel);
      if (!el) return [];
      const io = new IntersectionObserver(([e]) => setInView((v) => ({ ...v, [key]: e.isIntersecting })));
      io.observe(el);
      return [io];
    });
    return () => observers.forEach((o) => o.disconnect());
  }, []);

  const show = !menuOpen && !inView.hero && !inView.form && !inView.foot;
  return (
    <div className={s.dock} data-show={show ? "true" : "false"} aria-hidden={!show} role="region" aria-label="Quick action">
      <p className={s.dockP}>
        Websites from<b>{priceLabel}/mo</b>
      </p>
      <a className={`${s.btn} ${s.btnPrimary}`} href="#preview" tabIndex={show ? 0 : -1}>
        Request My Free Website Preview
      </a>
    </div>
  );
}

/**
 * "Request a free preview" on a package card. Works without JS as a
 * `?package=` link; with JS it sets the form's package and scrolls there.
 */
export function PackageRequestLink({
  pkg,
  className,
  ariaLabel,
  children,
}: {
  pkg: PackageChoice;
  className: string;
  ariaLabel: string;
  children: ReactNode;
}) {
  const { requestPackage } = useSelection();
  /* After mount, keep any existing query (e.g. utm_*) so new-tab and no-JS
     navigations keep their attribution. The server render uses the bare link. */
  const [href, setHref] = useState(`?package=${pkg}#preview`);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    q.set("package", pkg);
    setHref(`?${q.toString()}#preview`);
  }, [pkg]);
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    requestPackage(pkg);
  };
  return (
    <a className={className} href={href} aria-label={ariaLabel} onClick={onClick}>
      {children}
    </a>
  );
}

export function CopyEmailButton({ address }: { address: string }) {
  const [label, setLabel] = useState("Copy address");
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setLabel("Copied");
    } catch {
      const el = document.getElementById("email-addr");
      if (el) {
        const range = document.createRange();
        range.selectNodeContents(el);
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
      setLabel("Press copy to finish");
    }
    window.setTimeout(() => setLabel("Copy address"), 2200);
  };
  return (
    <button className={s.copyBtn} type="button" onClick={onClick}>
      {label}
    </button>
  );
}
