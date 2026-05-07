"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Clock3, Sparkle, Zap } from "lucide-react";

import {
  HoverGlowLayers,
  useHoverGlow,
} from "@/components/ui/hover-glow-card";
import type { CommandCenterApp } from "@/lib/command-center/types";
import {
  cardEntrance,
  cardInnerStagger,
  cardItem,
} from "@/components/command-center/motion/motion-presets";

type AppCardProps = {
  app: CommandCenterApp;
};

export function AppCard({ app }: AppCardProps) {
  const Icon = app.icon;
  const isAvailable = app.status === "available";
  const [hoverGlowRef, hoverGlowStyle, handlePointerMove, handlePointerLeave] =
    useHoverGlow<HTMLElement>();
  const shouldReduceMotion = useReducedMotion();

  const liveDataToneClasses = {
    positive: "border-emerald-300/20 bg-emerald-400/10 text-emerald-300",
    info: "border-cyan-300/20 bg-cyan-400/10 text-cyan-300",
    warning: "border-orange-300/20 bg-orange-400/10 text-orange-300",
    muted: "border-white/10 bg-white/[0.055] text-slate-400",
  };

  return (
    <motion.article
      ref={hoverGlowRef}
      variants={cardEntrance}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      whileHover={shouldReduceMotion ? undefined : { y: -5, scale: 1.006 }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={hoverGlowStyle}
      className="hover-glow-card group relative flex min-h-[620px] overflow-hidden rounded-[28px] border border-white/10 bg-[#07172c]/92 p-7 shadow-[0_24px_80px_rgba(0,0,0,0.24)] transition-[border-color,box-shadow,transform] duration-300 hover:border-cyan-300/45 hover:shadow-[0_28px_88px_rgba(0,0,0,0.28),0_0_34px_rgba(0,212,255,0.12)] sm:p-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,212,255,0.16),transparent_34%),radial-gradient(circle_at_12%_86%,rgba(8,126,255,0.12),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.055),transparent_42%)] opacity-75 transition-opacity duration-300 group-hover:opacity-100" />
      <HoverGlowLayers />

      <motion.div
        variants={cardInnerStagger}
        className="relative z-10 flex w-full flex-col"
      >
        <motion.div
          variants={cardItem}
          className="mb-8 flex items-start justify-between gap-4"
        >
          <div
            className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${app.accentClass} shadow-[0_18px_45px_rgba(0,212,255,0.18)]`}
          >
            <Icon className="h-8 w-8 text-white" />
          </div>

          <div className="flex flex-col items-end gap-2">
            <span
              className={
                isAvailable
                  ? "rounded-full border border-cyan-300/25 bg-cyan-400/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300"
                  : "rounded-full border border-white/15 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-white/60"
              }
            >
              {isAvailable ? "Available" : "Coming Soon"}
            </span>

            {app.tierLabel ? (
              <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
                {app.tierLabel}
              </span>
            ) : null}
          </div>
        </motion.div>

        <motion.div variants={cardItem}>
          <h3 className="text-3xl font-bold tracking-normal text-white sm:text-4xl">
            {app.name}
          </h3>

          <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
            {app.description}
          </p>
        </motion.div>

        {app.liveData ? (
          <motion.div
            variants={cardItem}
            className={`mt-6 rounded-2xl border px-5 py-4 text-sm font-semibold ${
              liveDataToneClasses[app.liveData.tone]
            }`}
          >
            <div className="flex items-center justify-between gap-4">
              <span>{app.liveData.message}</span>
              <span className="text-xs uppercase tracking-[0.16em] opacity-80">
                {app.liveData.actionLabel}
              </span>
            </div>
          </motion.div>
        ) : null}

        <motion.div variants={cardItem} className="mt-8">
          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300/75">
            <Sparkle className="h-3.5 w-3.5" />
            <span>Key Features</span>
          </div>

          <div className="flex flex-wrap gap-3">
            {app.features.map((feature) => (
              <span
                key={feature}
                className="rounded-xl border border-cyan-300/10 bg-white/[0.055] px-4 py-2 text-sm font-medium text-slate-200"
              >
                {feature}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div
          variants={cardItem}
          className="mt-8 rounded-2xl border border-white/10 bg-white/[0.045] p-5"
        >
          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-cyan-300/75">
            <Zap className="h-3.5 w-3.5 text-[#FFE521]" />
            <span>Example Use Cases</span>
          </div>

          <div className="space-y-3">
            {app.useCases.map((useCase) => (
              <div key={useCase} className="flex gap-3 text-sm text-slate-300">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFE521]" />
                <span>{useCase}</span>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          variants={cardItem}
          className="mt-auto flex flex-col gap-5 pt-8 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3 text-sm font-semibold text-cyan-300">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cyan-400/15">
              {app.includedInPlan ? (
                <Check className="h-4 w-4" />
              ) : (
                <Clock3 className="h-4 w-4" />
              )}
            </span>
            {app.includedInPlan
              ? `Included in ${app.tierLabel ?? "your plan"}`
              : "Upgrade required"}
          </div>

          {isAvailable && app.href ? (
            <a
              href={app.href}
              className="inline-flex items-center gap-3 rounded-2xl bg-cyan-400 px-6 py-3 font-semibold text-slate-950 shadow-[0_14px_36px_rgba(0,212,255,0.28)] transition duration-300 hover:bg-cyan-300 hover:shadow-[0_18px_46px_rgba(0,212,255,0.42)]"
            >
              Launch App
              <ArrowRight className="h-5 w-5" />
            </a>
          ) : (
            <button
              type="button"
              className="inline-flex items-center rounded-2xl bg-white/10 px-6 py-3 font-semibold text-white/55 transition hover:bg-white/15"
            >
              Notify Me
            </button>
          )}
        </motion.div>
      </motion.div>
    </motion.article>
  );
}
