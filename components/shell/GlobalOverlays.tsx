"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

import FloatingChatButton from "@/components/FloatingChatButton";
import { isFullScreenRoute } from "@/components/shell/nav";

export default function GlobalOverlays() {
  const pathname = usePathname();
  const fullScreen = isFullScreenRoute(pathname);

  if (fullScreen) return null;

  return <FloatingChatButton />;
}
