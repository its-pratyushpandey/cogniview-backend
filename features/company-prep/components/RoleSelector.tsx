"use client";

import { motion } from "framer-motion";
import { Search } from "lucide-react";

import { Role } from "@/features/company-prep/types";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

interface RoleSelectorProps {
  roles: Role[];
  selectedRoleId: string | null;
  roleSearch: string;
  onRoleSearchChange: (value: string) => void;
  onSelectRole: (roleId: string) => void;
  loading: boolean;
}

export function RoleSelector(props: RoleSelectorProps) {
  const {
    roles,
    selectedRoleId,
    roleSearch,
    onRoleSearchChange,
    onSelectRole,
    loading,
  } = props;

  return (
    <section className="space-y-4 rounded-2xl border border-border/70 bg-card/40 p-5 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold">Select Role</h3>
          <p className="text-sm text-muted-foreground">
            Role-specific skill coverage and adaptive difficulty will be applied.
          </p>
        </div>

        <div className="relative w-full sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={roleSearch}
            onChange={(event) => onRoleSearchChange(event.target.value)}
            placeholder="Search role"
            className="h-10 rounded-xl pl-9"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={`role-skeleton-${index}`} className="h-10 w-36 rounded-full" />
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => {
            const active = role.id === selectedRoleId;
            return (
              <motion.button
                key={role.id}
                type="button"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onSelectRole(role.id)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  active
                    ? "border-primary bg-primary text-primary-foreground shadow"
                    : "border-border bg-background/50 hover:border-primary/40 hover:bg-primary/5"
                }`}
              >
                {role.name}
              </motion.button>
            );
          })}
        </div>
      )}
    </section>
  );
}
