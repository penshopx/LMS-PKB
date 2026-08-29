import * as React from "react";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  ClipboardCheck,
  ExternalLink,
  FileCheck,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  GUSTAFTA_DOMAINS,
  getGustaftaLinksByDomain,
  type GustaftaDomainId,
  type GustaftaLink,
} from "@/lib/gustafta";

const domainIcons: Record<GustaftaDomainId, typeof FileCheck> = {
  legalitas: FileCheck,
  sertifikasi: ShieldCheck,
  tender: ClipboardCheck,
  proyek: BriefcaseBusiness,
};

function GustaftaLinkButton({ link, compact }: { link: GustaftaLink; compact: boolean }) {
  return (
    <Button
      asChild
      variant={link.primary ? "default" : "outline"}
      size={compact ? "sm" : "default"}
      className="w-full justify-between"
    >
      <a
        href={link.href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${link.cta}: ${link.title} di Gustafta`}
        data-testid={`link-gustafta-${link.id}`}
      >
        <span className="truncate">{link.cta}</span>
        <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
      </a>
    </Button>
  );
}

export function GustaftaEcosystem({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={compact ? "space-y-4" : "py-16 md:py-24 bg-muted/30"}
      data-testid="gustafta-ecosystem"
      aria-labelledby={compact ? "gustafta-ecosystem-title-compact" : "gustafta-ecosystem-title"}
    >
      <div className={compact ? "space-y-4" : "container mx-auto px-4"}>
        <div className={compact ? "space-y-1" : "text-center mb-10"}>
          <Badge variant="secondary" className="mb-3">
            <ExternalLink className="h-3 w-3 mr-1" aria-hidden="true" />
            Ekosistem kerja konstruksi
          </Badge>
          <h2
            id={compact ? "gustafta-ecosystem-title-compact" : "gustafta-ecosystem-title"}
            className={compact ? "text-xl font-bold" : "text-3xl font-bold mb-4"}
          >
            Dari belajar ke pekerjaan nyata
          </h2>
          <p className={compact ? "text-sm text-muted-foreground" : "text-muted-foreground max-w-3xl mx-auto"}>
            LMS PUB ASPEKINDO memperkuat pembelajaran dan kompetensi. Gustafta membantu melanjutkan
            langkah kerja pada legalitas, sertifikasi, tender, dan proyek.
          </p>
        </div>

        <div className={compact ? "grid gap-3 sm:grid-cols-2" : "grid md:grid-cols-2 lg:grid-cols-4 gap-6"}>
          {GUSTAFTA_DOMAINS.map((domain) => {
            const Icon = domainIcons[domain.id];
            const links = getGustaftaLinksByDomain(domain.id);

            return (
              <Card key={domain.id} className="h-full hover-elevate" data-testid={`card-gustafta-${domain.id}`}>
                <CardHeader className={compact ? "p-4" : undefined}>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                    <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <CardTitle className={compact ? "text-base" : "text-lg"}>{domain.title}</CardTitle>
                  <CardDescription>{domain.description}</CardDescription>
                </CardHeader>
                <CardContent className={compact ? "p-4 pt-0 space-y-2" : "space-y-2"}>
                  {links.map((link) => (
                    <GustaftaLinkButton key={link.id} link={link} compact={compact} />
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className={compact ? "text-xs text-muted-foreground" : "text-sm text-muted-foreground text-center mt-8"}>
          Tautan membuka Gustafta di tab baru. Layanan eksternal dan proses resmi mengikuti ketentuan
          platform serta instansi yang berwenang.
        </p>
      </div>
    </section>
  );
}