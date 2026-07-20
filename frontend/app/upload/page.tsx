"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useRouter } from "next/navigation";
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useDocumentStore } from "@/store/document-store";
import { apiFetch, backendUrl } from "@/lib/api";

interface UploadFile {
  file: File;
  status: "idle" | "uploading" | "processing" | "ready" | "failed";
  progress: number;
  error?: string;
  documentId?: string;
}

export default function UploadPage() {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const { addDocument } = useDocumentStore();
  const router = useRouter();

  const uploadFile = async (uf: UploadFile, index: number) => {
    const form = new FormData();
    form.append("file", uf.file);

    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, status: "uploading", progress: 10 } : f))
    );

    try {
      const res = await apiFetch("/api/documents/upload", {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error("Upload failed");
      const { document_id } = await res.json();

      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, status: "processing", progress: 40, documentId: document_id } : f))
      );

      // Poll SSE status
      const evtSource = new EventSource(
        backendUrl(`/api/documents/${document_id}/status`)
      );
      evtSource.onmessage = (e) => {
        const data = JSON.parse(e.data);
        const progress = { chunking: 60, embedding: 80, ready: 100, failed: 100 }[data.status as string] ?? 40;
        setFiles((prev) =>
          prev.map((f, i) =>
            i === index ? { ...f, status: data.status, progress, error: data.error } : f
          )
        );
        if (data.status === "ready") {
          evtSource.close();
          addDocument({
            id: document_id,
            original_name: uf.file.name,
            status: "ready",
            page_count: null,
            file_size_bytes: uf.file.size,
            created_at: new Date().toISOString(),
          });
        }
        if (data.status === "failed") evtSource.close();
      };
    } catch (err) {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index ? { ...f, status: "failed", progress: 0, error: String(err) } : f
        )
      );
      toast({ title: `Failed to upload ${uf.file.name}`, variant: "destructive" });
    }
  };

  const onDrop = useCallback(
    (accepted: File[]) => {
      const newFiles: UploadFile[] = accepted.map((f) => ({
        file: f,
        status: "idle",
        progress: 0,
      }));
      setFiles((prev) => {
        const updated = [...prev, ...newFiles];
        newFiles.forEach((_, relIdx) => uploadFile(updated[prev.length + relIdx], prev.length + relIdx));
        return updated;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"], "text/plain": [".txt"], "text/markdown": [".md"] },
    maxSize: 50 * 1024 * 1024,
  });

  const allDone = files.length > 0 && files.every((f) => f.status === "ready" || f.status === "failed");

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-xl space-y-6">
        <h1 className="text-2xl font-bold text-center">Upload Documents</h1>

        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors
            ${isDragActive ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"}`}
        >
          <input {...getInputProps()} />
          <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
          <p className="font-medium">Drop files here or click to browse</p>
          <p className="text-sm text-muted-foreground mt-1">PDF, DOCX, TXT, MD — up to 50 MB each</p>
        </div>

        {files.length > 0 && (
          <div className="space-y-3">
            {files.map((uf, i) => (
              <div key={i} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium flex-1 truncate">{uf.file.name}</span>
                  {uf.status === "ready" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                  {uf.status === "failed" && <AlertCircle className="h-4 w-4 text-destructive" />}
                  {["uploading", "processing", "chunking", "embedding"].includes(uf.status) && (
                    <Loader2 className="h-4 w-4 text-primary animate-spin" />
                  )}
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500
                      ${uf.status === "failed" ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${uf.progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground capitalize">
                  {uf.error ?? uf.status.replace("_", " ")}
                </p>
              </div>
            ))}
          </div>
        )}

        {allDone && (
          <button
            onClick={() => router.push("/dashboard")}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Go to Dashboard →
          </button>
        )}
      </div>
    </div>
  );
}
