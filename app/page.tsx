"use client"

import { motion } from "framer-motion"
import ScrollReveal from "@/components/ScrollReveal"
import DockMenu from "@/components/DockMenu"
import ParallaxSection from "@/components/ParallaxSection"

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-entrepreneuria text-white overflow-hidden flex flex-col">
      {/* === Hero Section === */}
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 pt-12 sm:pt-16">
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-5xl sm:text-6xl font-bold mb-6 text-balance"
        >
          Everything You Need, All in One Place
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="text-lg sm:text-xl max-w-2xl opacity-90 mb-10"
        >
          Entrepreneuria brings together AI mentorship, automation, and digital resources
          so you can focus on what matters—growth, not guesswork.
        </motion.p>

        <div className="flex flex-col sm:flex-row gap-4">
          <a
            href="/exchange/digital-vault"
            className="px-6 py-3 rounded-full bg-white text-[#4f7ca7] font-semibold shadow-md hover:bg-[#d27a2c] hover:text-white transition duration-300"
          >
            Explore the Vault
          </a>
          <a
            href="/pricing"
            className="px-6 py-3 rounded-full border border-white/40 hover:bg-white/10 transition duration-300"
          >
            View Plans
          </a>
        </div>
      </div>

      {/* === Feature Section === */}
      <section className="relative py-24 px-6 sm:px-12 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-4xl sm:text-5xl font-bold mb-10"
        >
          Explore Our Ecosystem
        </motion.h2>

        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
          {/* The Digital Vault */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.1 }}
            className="card-glass p-8 rounded-2xl text-left"
          >
            <h3 className="text-2xl font-semibold mb-3 text-white">The Digital Vault</h3>
            <p className="opacity-90 mb-4">
              Access a curated collection of digital products, templates, and business systems
              designed to help you scale faster.
            </p>
            <a href="/exchange/digital-vault" className="text-[#d27a2c] font-semibold hover:underline">
              Explore the Vault →
            </a>
          </motion.div>

          {/* The Agentverse */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="card-glass p-8 rounded-2xl text-left"
          >
            <h3 className="text-2xl font-semibold mb-3 text-white">The Agentverse</h3>
            <p className="opacity-90 mb-4">
              Shop purpose-built AI agents that handle your toughest tasks. From marketing managers
              to admin assistants, Agentverse connects you with ready-to-deploy AI teammates.
            </p>
            <a href="/exchange/agentverse" className="text-[#d27a2c] font-semibold hover:underline">
              Visit the Agentverse →
            </a>
          </motion.div>

          {/* Prospra */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="card-glass p-8 rounded-2xl text-left"
          >
            <h3 className="text-2xl font-semibold mb-3 text-white">Prospra</h3>
            <p className="opacity-90 mb-4">
              Get 24/7 mentorship and tailored business advice with <strong>Prospra</strong>,
              your AI-powered startup mentor designed to help you grow smarter and faster.
            </p>
            <a href="/prospra" className="text-[#d27a2c] font-semibold hover:underline">
              Meet Prospra →
            </a>
          </motion.div>

          {/* Synceri */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="card-glass p-8 rounded-2xl text-left"
          >
            <h3 className="text-2xl font-semibold mb-3 text-white">Synceri</h3>
            <p className="opacity-90 mb-4">
              Your AI-powered Life Admin Assistant. <strong>Synceri</strong> keeps your calendar,
              reminders, and daily to-dos running smoothly—so you can focus on what matters most.
            </p>
            <a href="/synceri" className="text-[#d27a2c] font-semibold hover:underline">
              Meet Synceri →
            </a>
          </motion.div>
        </div>
      </section>

      {/* === Closing CTA === */}
      <section className="py-32 px-6 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="text-4xl sm:text-5xl font-bold mb-6"
        >
          Start Building Smarter Today
        </motion.h2>
        <p className="max-w-2xl mx-auto text-lg opacity-90 mb-8">
          Join Entrepreneuria and unlock access to AI mentors, admin support, and digital systems
          that help you grow with clarity and confidence.
        </p>
        <a
          href="/pricing"
          className="px-8 py-3 rounded-full bg-white text-[#4f7ca7] font-semibold hover:bg-[#d27a2c] hover:text-white transition duration-300"
        >
          Get Started
        </a>
      </section>

      {/* === Dock Menu (reveals on scroll) === */}
      <ScrollReveal>
        <section className="mt-24 mb-16 flex justify-center">
          <DockMenu />
        </section>
      </ScrollReveal>
    </main>
  )
}
