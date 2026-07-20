"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { FileSearch, Zap, Shield, GitBranch } from "lucide-react";

const features = [
  {
    icon: FileSearch,
    title: "Multi-Agent RAG",
    desc: "Router, Fact, Analysis, and Fallback agents handle any query type across 100K-token corpora.",
  },
  {
    icon: Zap,
    title: "Sub-2s Responses",
    desc: "HNSW pgvector indexing + cross-encoder reranking delivers p95 latency under 2 seconds.",
  },
  {
    icon: Shield,
    title: "Verifiable Citations",
    desc: "Every claim traces back to a specific page and paragraph. No hallucinations slip through.",
  },
  {
    icon: GitBranch,
    title: "87% Retrieval Precision",
    desc: "Cosine similarity + ms-marco reranking surfaces the right chunks every time.",
  },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-lg tracking-tight">RAG Doc Intelligence</span>
        <div className="flex gap-3">
          <Link
            href="/auth/signin"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/auth/signin"
            className="text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-md hover:opacity-90 transition-opacity"
          >
            Get started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <motion.h1
          className="text-5xl font-bold tracking-tight mb-6"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          Ask questions across your documents.
          <br />
          <span className="text-primary">Get cited answers instantly.</span>
        </motion.h1>
        <motion.p
          className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Upload PDFs, DOCX, and Markdown files. Ask anything. Every response includes
          source citations with page numbers and confidence scores.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Link
            href="/auth/signin"
            className="inline-block bg-primary text-primary-foreground px-8 py-3 rounded-lg text-lg font-medium hover:opacity-90 transition-opacity"
          >
            Start analysing documents →
          </Link>
        </motion.div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-6 pb-24 grid grid-cols-1 sm:grid-cols-2 gap-6">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            className="border rounded-xl p-6 bg-card"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 * i + 0.3 }}
          >
            <f.icon className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-semibold text-lg mb-1">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </motion.div>
        ))}
      </section>
    </main>
  );
}
