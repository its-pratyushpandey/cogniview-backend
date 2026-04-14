"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
      Loading editor…
    </div>
  ),
});

export default function CodeEditor({ 
  code, 
  language, 
  onChange, 
  height = "100%",
  readOnly = false 
}: CodeEditorProps) {

  const editorRef = useRef<unknown>(null);

  const handleEditorDidMount = (editor: unknown) => {
    editorRef.current = editor;
    if (editor && typeof (editor as { focus: () => void }).focus === 'function') {
      (editor as { focus: () => void }).focus();
    }
  };

  const languageMap: Record<string, string> = {
    python: "python",
    java: "java",
    cpp: "cpp",
    javascript: "javascript"
  };

  return (
    <motion.div 
      className="code-editor-wrapper"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
    >
      <MonacoEditor
        height={height}
        language={languageMap[language] || "python"}
        value={code}
        onChange={(value) => onChange(value || "")}
        onMount={handleEditorDidMount}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 15,
          fontFamily: "'Fira Code', 'Cascadia Code', 'Monaco', 'Courier New', monospace",
          fontLigatures: true,
          lineNumbers: "on",
          renderWhitespace: "selection",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
          readOnly,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "explicit",
          smoothScrolling: true,
          suggestOnTriggerCharacters: true,
          quickSuggestions: true,
          formatOnPaste: false,
          formatOnType: false,
          padding: { top: 20, bottom: 20 },
          glyphMargin: false,
          folding: true,
          lineDecorationsWidth: 10,
          lineNumbersMinChars: 3,
          renderLineHighlight: "all",
          scrollbar: {
            verticalScrollbarSize: 10,
            horizontalScrollbarSize: 10,
            useShadows: false
          }
        }}
      />

      <style jsx>{`
        .code-editor-wrapper {
          width: 100%;
          overflow: hidden;
          border-radius: 16px;
          background: hsl(var(--background));
          border: 1px solid hsl(var(--border) / 0.88);
          box-shadow: 
            0 20px 50px hsl(var(--background) / 0.55),
            inset 0 0 100px hsl(var(--primary) / 0.08);
          position: relative;
        }
        
        .code-editor-wrapper::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 40px;
          background: linear-gradient(180deg, hsl(var(--primary) / 0.14) 0%, transparent 100%);
          pointer-events: none;
          z-index: 1;
        }
      `}</style>
    </motion.div>
  );
}
