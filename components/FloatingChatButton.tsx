"use client";

import { useState } from "react";
import { MessageSquare, X } from "lucide-react";
import dynamic from "next/dynamic";

const ChatWindow = dynamic(() => import("./chat/ChatWindow"), { ssr: false });

export default function FloatingChatButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        type="button"
        aria-label="Open Kiki AI chat"
        className={`fixed bottom-4 right-4 z-[9999] group flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-2xl transition-transform duration-150 hover:scale-105 active:scale-95 sm:bottom-6 sm:right-6 sm:h-16 sm:w-16 ${
          isOpen ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
      >
        <MessageSquare className="w-6 h-6" />
        
        {/* Tooltip */}
        <div className="absolute right-full mr-3 hidden whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1 text-sm text-white opacity-0 transition-opacity group-hover:opacity-100 sm:block">
          Chat with Kiki AI
          <div className="absolute top-1/2 -right-1 transform -translate-y-1/2 border-l-4 border-l-gray-900 border-t-2 border-b-2 border-t-transparent border-b-transparent" />
        </div>
      </button>

      {/* Chat Modal */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-[9998] bg-black/50"
          />

          {/* Modal Content */}
          <div
            className="fixed bottom-4 left-3 right-3 z-[9999] h-[min(82vh,680px)] sm:bottom-[90px] sm:left-auto sm:right-[60px] sm:h-[560px] sm:w-[380px]"
          >
            {/* Close Button */}
            <button
              onClick={() => setIsOpen(false)}
              type="button"
              aria-label="Close chat"
              className="absolute right-2 top-2 z-[10000] flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-lg transition-colors hover:text-gray-800 sm:-right-2 sm:-top-2 sm:h-6 sm:w-6"
            >
              <X className="w-3 h-3" />
            </button>

            <div className="h-full w-full origin-bottom-right scale-100 opacity-100 transition-all duration-150">
              <ChatWindow />
            </div>
          </div>
        </>
      )}
    </>
  );
}