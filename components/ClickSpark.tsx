"use client";

import React, { useEffect } from "react";

export const ClickSpark = () => {
  useEffect(() => {
    const createSpark = (x: number, y: number) => {
      const spark = document.createElement("div");
      spark.className = "spark";
      spark.style.left = `${x}px`;
      spark.style.top = `${y}px`;
      document.body.appendChild(spark);

      setTimeout(() => spark.remove(), 800);
    };

    const handleClick = (e: MouseEvent) => {
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * 2 * Math.PI;
        const x = e.clientX + Math.cos(angle) * 10;
        const y = e.clientY + Math.sin(angle) * 10;
        createSpark(x, y);
      }
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  return null;
};
