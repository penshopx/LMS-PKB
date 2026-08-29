export type GustaftaDomainId = "legalitas" | "sertifikasi" | "tender" | "proyek";

export interface GustaftaDomain {
  id: GustaftaDomainId;
  title: string;
  description: string;
}

export interface GustaftaLink {
  id: string;
  domain: GustaftaDomainId;
  title: string;
  description: string;
  href: string;
  cta: string;
  primary?: boolean;
}

export const GUSTAFTA_HOME_URL = "https://gustafta.my.id";

export const GUSTAFTA_DOMAINS: readonly GustaftaDomain[] = [
  {
    id: "legalitas",
    title: "SIAP Legalitas dan Perizinan",
    description: "Lanjutkan diagnosis kesiapan SBU dan petakan area legalitas yang perlu dibereskan.",
  },
  {
    id: "sertifikasi",
    title: "SIAP Sertifikasi",
    description: "Temukan jalur persiapan SKK dan dukungan kompetensi untuk tenaga kerja konstruksi.",
  },
  {
    id: "tender",
    title: "SIAP Tender",
    description: "Baca peluang tender dengan konteks sebelum menyiapkan respons dan dokumen penawaran.",
  },
  {
    id: "proyek",
    title: "SIAP Proyek",
    description: "Bawa pembelajaran ke ruang kerja untuk administrasi dan pengendalian pekerjaan berjalan.",
  },
];

export const GUSTAFTA_ECOSYSTEM_LINKS: readonly GustaftaLink[] = [
  {
    id: "sbu-readiness",
    domain: "legalitas",
    title: "Cek Kesiapan SBU",
    description: "Diagnosis awal untuk melihat area kesiapan badan usaha, personel, pengalaman, dan dokumen.",
    href: `${GUSTAFTA_HOME_URL}/cek-kesiapan-sbu`,
    cta: "Buka diagnosis",
    primary: true,
  },
  {
    id: "skk-portal",
    domain: "sertifikasi",
    title: "Portal Ekosistem SKK",
    description: "Jelajahi pilihan persiapan SKK untuk asesi, asesor, LSP, TUK, dan perusahaan jasa konstruksi.",
    href: `${GUSTAFTA_HOME_URL}/skk`,
    cta: "Buka portal SKK",
    primary: true,
  },
  {
    id: "tender-opportunities",
    domain: "tender",
    title: "Peluang Tender",
    description: "Temukan ruang tender Gustafta sebagai lanjutan dari pembelajaran kualifikasi dan penawaran.",
    href: `${GUSTAFTA_HOME_URL}/tender`,
    cta: "Jelajahi tender",
    primary: true,
  },
  {
    id: "project-workspace",
    domain: "proyek",
    title: "Ruang Proyek",
    description: "Kelola administrasi, dokumen, costing, dan ritme pekerjaan dalam satu ruang proyek.",
    href: `${GUSTAFTA_HOME_URL}/ruang-proyek`,
    cta: "Buka ruang proyek",
    primary: true,
  },
  {
    id: "project-documents",
    domain: "proyek",
    title: "Dokumen Proyek",
    description: "Temukan dukungan jasa dokumen, keuangan, dan kebutuhan pekerjaan konstruksi.",
    href: `${GUSTAFTA_HOME_URL}/dokumen-proyek`,
    cta: "Lihat dokumen",
  },
];

export function getGustaftaLinksByDomain(domain: GustaftaDomainId): GustaftaLink[] {
  return GUSTAFTA_ECOSYSTEM_LINKS.filter((link) => link.domain === domain);
}