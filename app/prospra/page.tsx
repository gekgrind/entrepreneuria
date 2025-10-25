// app/prospra/page.tsx
"use client";

import React from "react";

export default function ProspraPage() {
  return (
    <section
      data-reveal
      className="pt-24 pb-32 min-h-screen flex flex-col items-center justify-center text-center bg-gradient-to-br from-[#4f7ca7] to-[#d27a2c] text-white"
    >
      {/* Hero Section */}
      <div data-reveal className="max-w-3xl">
        <h1 className="text-6xl font-extrabold mb-4 drop-shadow-lg">
          🚀 Meet Prospra
        </h1>
        <p className="text-lg md:text-xl mb-8 opacity-90 leading-relaxed">
          Your personal AI mentor for entrepreneurs.  
          Prospra helps you set smarter goals, overcome roadblocks,  
          and grow your business with clarity and confidence.
        </p>
        <button
          data-reveal
          className="mt-6 px-8 py-3 rounded-full bg-white text-[#4f7ca7] font-semibold hover:scale-105 transition-transform duration-300"
        >
          Start Free Trial
        </button>
      </div>

      {/* Feature Highlights */}
      <div className="mt-20 grid gap-8 md:grid-cols-3 max-w-5xl w-full px-6">
        <div
          data-reveal
          className="bg-white/10 p-6 rounded-2xl backdrop-blur-sm hover:bg-white/20 transition"
        >
          <h3 className="text-2xl font-bold mb-2">💡 Smart Insights</h3>
          <p className="text-sm opacity-80">
            Get tailored strategies for every stage of your startup journey.
          </p>
        </div>

        <div
          data-reveal
          className="bg-white/10 p-6 rounded-2xl backdrop-blur-sm hover:bg-white/20 transition"
        >
          <h3 className="text-2xl font-bold mb-2">🧠 AI Mentorship</h3>
          <p className="text-sm opacity-80">
            24/7 guidance that adapts to your goals and experience level.
          </p>
        </div>

        <div
          data-reveal
          className="bg-white/10 p-6 rounded-2xl backdrop-blur-sm hover:bg-white/20 transition"
        >
          <h3 className="text-2xl font-bold mb-2">📈 Growth Playbooks</h3>
          <p className="text-sm opacity-80">
            Proven frameworks and tools to help you scale faster with clarity.
          </p>
        </div>
      </div>
    </section>
  );
}
