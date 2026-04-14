"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Company,
  CompanyListResponse,
  CompanyRoleSuggestion,
  CompanyRolesResponse,
  Role,
} from "@/features/company-prep/types";
import { useDebouncedValue } from "@/features/company-prep/hooks/useDebouncedValue";

interface UseCompanyDataInput {
  userId: string;
  initialCompanyId?: string | null;
  initialRoleId?: string | null;
}

interface UseCompanyDataResult {
  companies: Company[];
  roles: Role[];
  selectedCompanyId: string | null;
  selectedRoleId: string | null;
  setSelectedCompanyId: (companyId: string) => void;
  setSelectedRoleId: (roleId: string) => void;
  companySearch: string;
  setCompanySearch: (value: string) => void;
  roleSearch: string;
  setRoleSearch: (value: string) => void;
  suggestions: CompanyRoleSuggestion;
  loadingCompanies: boolean;
  loadingRoles: boolean;
  error: string | null;
  refreshCompanies: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T;
  return body;
}

export function useCompanyData(input: UseCompanyDataInput): UseCompanyDataResult {
  const { userId, initialCompanyId = null, initialRoleId = null } = input;

  const [companies, setCompanies] = useState<Company[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(initialCompanyId);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(initialRoleId);
  const [companySearch, setCompanySearch] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [suggestions, setSuggestions] = useState<CompanyRoleSuggestion>({ companyIds: [], roleIds: [] });
  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initialCompanyIdRef = useRef<string | null>(initialCompanyId);
  const initialRoleIdRef = useRef<string | null>(initialRoleId);

  const debouncedCompanySearch = useDebouncedValue(companySearch, 300);
  const debouncedRoleSearch = useDebouncedValue(roleSearch, 250);

  const selectDefaultCompany = useCallback(
    (nextCompanies: Company[], nextSuggestions: CompanyRoleSuggestion): string | null => {
      if (nextCompanies.length === 0) {
        return null;
      }

      const pendingInitialCompanyId = initialCompanyIdRef.current;
      if (pendingInitialCompanyId && nextCompanies.some((company) => company.id === pendingInitialCompanyId)) {
        initialCompanyIdRef.current = null;
        return pendingInitialCompanyId;
      }

      if (pendingInitialCompanyId) {
        initialCompanyIdRef.current = null;
      }

      if (selectedCompanyId && nextCompanies.some((company) => company.id === selectedCompanyId)) {
        return selectedCompanyId;
      }

      const suggested = nextSuggestions.companyIds.find((id) => nextCompanies.some((company) => company.id === id));
      return suggested ?? nextCompanies[0].id;
    },
    [selectedCompanyId]
  );

  const refreshCompanies = useCallback(async () => {
    setLoadingCompanies(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (debouncedCompanySearch.trim()) {
        params.set("search", debouncedCompanySearch.trim());
      }
      if (userId) {
        params.set("userId", userId);
      }

      const response = await fetch(`/api/company/list?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch companies: ${response.status}`);
      }

      const payload = await parseJsonResponse<CompanyListResponse>(response);
      setCompanies(payload.companies);
      setSuggestions(payload.suggestions);

      const fallbackCompany = selectDefaultCompany(payload.companies, payload.suggestions);
      setSelectedCompanyId(fallbackCompany);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch companies");
    } finally {
      setLoadingCompanies(false);
    }
  }, [debouncedCompanySearch, selectDefaultCompany, userId]);

  const refreshRoles = useCallback(async () => {
    if (!selectedCompanyId) {
      setRoles([]);
      setSelectedRoleId(null);
      return;
    }

    setLoadingRoles(true);
    setError(null);

    try {
      const params = new URLSearchParams({ companyId: selectedCompanyId });
      if (debouncedRoleSearch.trim()) {
        params.set("search", debouncedRoleSearch.trim());
      }

      const response = await fetch(`/api/company/roles?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch roles: ${response.status}`);
      }

      const payload = await parseJsonResponse<CompanyRolesResponse>(response);
      setRoles(payload.roles);

      if (payload.roles.length === 0) {
        setSelectedRoleId(null);
        return;
      }

      const pendingInitialRoleId = initialRoleIdRef.current;
      if (pendingInitialRoleId && payload.roles.some((role) => role.id === pendingInitialRoleId)) {
        setSelectedRoleId(pendingInitialRoleId);
        initialRoleIdRef.current = null;
        return;
      }

      if (pendingInitialRoleId) {
        initialRoleIdRef.current = null;
      }

      const hasCurrentRole = selectedRoleId
        ? payload.roles.some((role) => role.id === selectedRoleId)
        : false;

      if (hasCurrentRole && selectedRoleId) {
        return;
      }

      const suggestedRole = suggestions.roleIds.find((roleId) =>
        payload.roles.some((role) => role.id === roleId)
      );

      setSelectedRoleId(suggestedRole ?? payload.roles[0].id);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to fetch roles");
    } finally {
      setLoadingRoles(false);
    }
  }, [debouncedRoleSearch, selectedCompanyId, selectedRoleId, suggestions.roleIds]);

  useEffect(() => {
    void refreshCompanies();
  }, [refreshCompanies]);

  useEffect(() => {
    void refreshRoles();
  }, [refreshRoles]);

  const stableSuggestions = useMemo(
    () => ({
      companyIds: suggestions.companyIds,
      roleIds: suggestions.roleIds,
      reason: suggestions.reason,
    }),
    [suggestions.companyIds, suggestions.roleIds, suggestions.reason]
  );

  return {
    companies,
    roles,
    selectedCompanyId,
    selectedRoleId,
    setSelectedCompanyId,
    setSelectedRoleId,
    companySearch,
    setCompanySearch,
    roleSearch,
    setRoleSearch,
    suggestions: stableSuggestions,
    loadingCompanies,
    loadingRoles,
    error,
    refreshCompanies,
    refreshRoles,
  };
}
