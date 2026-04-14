"use client";

import { motion } from "framer-motion";
import { Building2, Search } from "lucide-react";

import { Company, CompanyRoleSuggestion } from "@/features/company-prep/types";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface CompanySelectionGridProps {
  companies: Company[];
  selectedCompanyId: string | null;
  suggestions: CompanyRoleSuggestion;
  loading: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onSelectCompany: (companyId: string) => void;
}

function CompanyGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <Card key={`company-skeleton-${index}`} className="overflow-hidden rounded-2xl border">
          <CardContent className="space-y-4 p-5">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function CompanySelectionGrid(props: CompanySelectionGridProps) {
  const {
    companies,
    selectedCompanyId,
    suggestions,
    loading,
    searchValue,
    onSearchChange,
    onSelectCompany,
  } = props;

  return (
    <section className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Choose Your Target Company</h2>
          <p className="text-sm text-muted-foreground">
            Company-specific question patterns, interviews, and test roadmaps are applied automatically.
          </p>
        </div>

        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search company"
            className="h-10 rounded-xl pl-9"
          />
        </div>
      </div>

      {loading ? (
        <CompanyGridSkeleton />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {companies.map((company, index) => {
            const selected = company.id === selectedCompanyId;
            const suggested = suggestions.companyIds.includes(company.id);

            return (
              <motion.button
                key={company.id}
                type="button"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.3) }}
                whileHover={{ y: -3, scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => onSelectCompany(company.id)}
                className="text-left"
              >
                <Card
                  className={`relative h-full overflow-hidden rounded-2xl border transition-all ${
                    selected
                      ? "border-primary shadow-lg ring-2 ring-primary/30"
                      : "border-border/70 hover:border-primary/40"
                  }`}
                >
                  <CardContent className="space-y-4 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border bg-primary/10 text-primary">
                        <Building2 className="h-5 w-5" />
                      </div>

                      <div className="flex flex-wrap justify-end gap-2">
                        {suggested ? <Badge variant="muted">Suggested</Badge> : null}
                        {selected ? <Badge>Selected</Badge> : null}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold">{company.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {company.description ?? "Interview-focused preparation path"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {company.frequentTopics.slice(0, 3).map((topic) => (
                        <Badge key={`${company.id}-${topic}`} variant="outline" className="capitalize">
                          {topic.replace(/-/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.button>
            );
          })}
        </div>
      )}
    </section>
  );
}
