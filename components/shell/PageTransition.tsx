"use client";

import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      key={pathname}
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.09, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}
