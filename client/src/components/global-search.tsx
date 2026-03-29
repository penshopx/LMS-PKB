import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, Users, BookOpen, FolderOpen, Loader2, X } from "lucide-react";
import { useLocation } from "wouter";
import type { Participant, ECourse, UnitCompetency } from "@shared/schema";

interface SearchResults {
  participants: Participant[];
  courses: ECourse[];
  units: UnitCompetency[];
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [, navigate] = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isFetching } = useQuery<SearchResults>({
    queryKey: ["/api/search", query],
    queryFn: async () => {
      if (!query.trim() || query.length < 2) return { participants: [], courses: [], units: [] };
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      return res.json();
    },
    enabled: query.length >= 2,
    staleTime: 10000,
  });

  const hasResults = data && (
    (data.participants?.length || 0) +
    (data.courses?.length || 0) +
    (data.units?.length || 0)
  ) > 0;

  const showDropdown = isOpen && query.length >= 2;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  function handleNavigate(href: string) {
    navigate(href);
    setIsOpen(false);
    setQuery("");
  }

  return (
    <div ref={containerRef} className="relative w-64 md:w-72" data-testid="global-search">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder="Cari... (Ctrl+K)"
          className="pl-8 pr-8 h-8 text-sm"
          data-testid="input-global-search"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setIsOpen(false); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            data-testid="button-clear-search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full mt-1 left-0 right-0 z-50 rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
          {isFetching && (
            <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Mencari...</span>
            </div>
          )}

          {!isFetching && !hasResults && (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              Tidak ditemukan hasil untuk "{query}"
            </div>
          )}

          {!isFetching && hasResults && (
            <div className="max-h-72 overflow-y-auto">
              {(data?.participants?.length || 0) > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                    <Users className="h-3 w-3" /> Peserta
                  </div>
                  {data!.participants.map(p => (
                    <button
                      key={p.id}
                      onClick={() => handleNavigate("/app/participants")}
                      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                      data-testid={`search-result-participant-${p.id}`}
                    >
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.position} · {p.unit}</div>
                    </button>
                  ))}
                </div>
              )}

              {(data?.participants?.length || 0) > 0 && (data?.courses?.length || 0) > 0 && (
                <Separator />
              )}

              {(data?.courses?.length || 0) > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                    <BookOpen className="h-3 w-3" /> E-Course
                  </div>
                  {data!.courses.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleNavigate("/app/courses")}
                      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                      data-testid={`search-result-course-${c.id}`}
                    >
                      <div className="text-sm font-medium">{c.title}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Badge variant="outline" className="text-xs h-4">{c.targetLevel}</Badge>
                        <span className="text-xs text-muted-foreground">{c.duration}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {((data?.courses?.length || 0) > 0 || (data?.participants?.length || 0) > 0) && (data?.units?.length || 0) > 0 && (
                <Separator />
              )}

              {(data?.units?.length || 0) > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                    <FolderOpen className="h-3 w-3" /> Unit Kompetensi
                  </div>
                  {data!.units.map(u => (
                    <button
                      key={u.id}
                      onClick={() => handleNavigate("/app/competencies")}
                      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                      data-testid={`search-result-unit-${u.id}`}
                    >
                      <div className="text-sm font-medium">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.code}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
