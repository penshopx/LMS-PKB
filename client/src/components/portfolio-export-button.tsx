import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";

export function PortfolioExportButton({ participantId }: { participantId: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setPending(true);
    setError("");
    try {
      const response = await apiRequest("GET", `/api/participants/${encodeURIComponent(participantId)}/portfolio-export`);
      // apiRequest checks account ownership after consuming the private body too.
      const html = await response.text();
      const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "portofolio-pkb.html";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ekspor gagal. Silakan coba kembali.");
    } finally {
      setPending(false);
    }
  }
  return <div className="space-y-1">
    <Button variant="outline" disabled={pending} onClick={download} data-testid="button-download-passport">
      <Download className="mr-1 h-4 w-4" />{pending ? "Menyiapkan..." : "Unduh portofolio"}
    </Button>
    {error && <p role="alert" className="max-w-sm text-sm text-destructive">{error}</p>}
  </div>;
}
