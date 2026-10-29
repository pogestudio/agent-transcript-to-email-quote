"use client";

import { useState } from "react";

const RESET_MS = 1500;

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), RESET_MS);
  }

  return (
    <button type="button" className="btn btn-sm" onClick={copy}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
