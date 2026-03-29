import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Home } from "lucide-react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] p-6" data-testid="page-not-found">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center pt-8 pb-8 text-center">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">404 - Halaman Tidak Ditemukan</h1>
          <p className="text-muted-foreground mb-6">
            Maaf, halaman yang Anda cari tidak tersedia atau telah dipindahkan.
          </p>
          <Link href="/">
            <Button data-testid="button-back-home">
              <Home className="h-4 w-4 mr-2" />
              Kembali ke Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
