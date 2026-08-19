import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";

import type { Branch, Company } from "@argin/company";
import {
  SqliteBranchRepository,
  SqliteCompanyRepository
} from "@argin/company-tauri";
import { getDesktopDatabase } from "@argin/database-tauri";
import type { FiscalYear } from "@argin/fiscal";
import { SqliteFiscalYearRepository } from "@argin/fiscal-tauri";

interface ActiveContextValue {
  companies: readonly Company[];
  branches: readonly Branch[];
  fiscalYears: readonly FiscalYear[];
  companyId: string;
  branchId: string;
  fiscalYearId: string;
  activeCompany: Company | null;
  activeBranch: Branch | null;
  activeFiscalYear: FiscalYear | null;
  isLoading: boolean;
  error: string;
  setCompanyId(value: string): void;
  setBranchId(value: string): void;
  setFiscalYearId(value: string): void;
  refresh(): Promise<void>;
}

const ActiveContext = createContext<ActiveContextValue | undefined>(undefined);

function getErrorMessage(reason: unknown): string {
  return reason instanceof Error
    ? reason.message
    : "بارگذاری زمینه کاری برنامه با خطا مواجه شد.";
}

export function ActiveContextProvider({ children }: PropsWithChildren) {
  const [companies, setCompanies] = useState<readonly Company[]>([]);
  const [branches, setBranches] = useState<readonly Branch[]>([]);
  const [fiscalYears, setFiscalYears] = useState<readonly FiscalYear[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [branchId, setBranchId] = useState("");
  const [fiscalYearId, setFiscalYearId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCompanies = useCallback(async () => {
    const database = await getDesktopDatabase();
    const values = await new SqliteCompanyRepository(database).findAll();
    setCompanies(values);
    setCompanyId((current) =>
      values.some((item) => item.id === current)
        ? current
        : values[0]?.id ?? ""
    );
  }, []);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      await loadCompanies();
    } catch (reason) {
      setError(getErrorMessage(reason));
    } finally {
      setIsLoading(false);
    }
  }, [loadCompanies]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    let cancelled = false;

    if (!companyId) {
      setBranches([]);
      setFiscalYears([]);
      setBranchId("");
      setFiscalYearId("");
      return;
    }

    void getDesktopDatabase()
      .then(async (database) => {
        const branchRepository = new SqliteBranchRepository(database);
        const fiscalYearRepository = new SqliteFiscalYearRepository(database);
        const [loadedBranches, loadedFiscalYears, currentFiscalYear] =
          await Promise.all([
            branchRepository.findByCompanyId(companyId),
            fiscalYearRepository.findByCompanyId(companyId),
            fiscalYearRepository.findCurrent(companyId)
          ]);
        return { loadedBranches, loadedFiscalYears, currentFiscalYear };
      })
      .then(({ loadedBranches, loadedFiscalYears, currentFiscalYear }) => {
        if (cancelled) return;
        setBranches(loadedBranches);
        setFiscalYears(loadedFiscalYears);
        setBranchId((current) =>
          loadedBranches.some((item) => item.id === current)
            ? current
            : loadedBranches.find((item) => item.isHeadOffice)?.id ??
              loadedBranches[0]?.id ??
              ""
        );
        setFiscalYearId((current) =>
          loadedFiscalYears.some((item) => item.id === current)
            ? current
            : currentFiscalYear?.id ??
              loadedFiscalYears.find((item) => item.status === "open")?.id ??
              loadedFiscalYears[0]?.id ??
              ""
        );
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(getErrorMessage(reason));
      });

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const value = useMemo<ActiveContextValue>(() => ({
    companies,
    branches,
    fiscalYears,
    companyId,
    branchId,
    fiscalYearId,
    activeCompany: companies.find((item) => item.id === companyId) ?? null,
    activeBranch: branches.find((item) => item.id === branchId) ?? null,
    activeFiscalYear: fiscalYears.find((item) => item.id === fiscalYearId) ?? null,
    isLoading,
    error,
    setCompanyId,
    setBranchId,
    setFiscalYearId,
    refresh
  }), [
    companies,
    branches,
    fiscalYears,
    companyId,
    branchId,
    fiscalYearId,
    isLoading,
    error,
    refresh
  ]);

  return (
    <ActiveContext.Provider value={value}>
      {children}
    </ActiveContext.Provider>
  );
}

export function useActiveContext(): ActiveContextValue {
  const context = useContext(ActiveContext);
  if (context === undefined) {
    throw new Error("useActiveContext must be used inside ActiveContextProvider.");
  }
  return context;
}
