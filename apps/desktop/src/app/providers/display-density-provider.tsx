import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type DisplayDensity = "compact" | "comfortable" | "spacious";

const STORAGE_KEY = "argin.ui.display-density";
const DEFAULT_DENSITY: DisplayDensity = "comfortable";

interface DisplayDensityContextValue {
  density: DisplayDensity;
  setDensity: (density: DisplayDensity) => void;
}

const DisplayDensityContext = createContext<DisplayDensityContextValue | null>(null);

function isDisplayDensity(value: string | null): value is DisplayDensity {
  return value === "compact" || value === "comfortable" || value === "spacious";
}

function readInitialDensity(): DisplayDensity {
  if (typeof window === "undefined") return DEFAULT_DENSITY;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isDisplayDensity(stored) ? stored : DEFAULT_DENSITY;
  } catch {
    return DEFAULT_DENSITY;
  }
}

export function DisplayDensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensityState] = useState<DisplayDensity>(readInitialDensity);

  useEffect(() => {
    document.documentElement.dataset.density = density;
    try {
      window.localStorage.setItem(STORAGE_KEY, density);
    } catch {
      // UI preference persistence must never block application rendering.
    }
  }, [density]);

  const value = useMemo<DisplayDensityContextValue>(
    () => ({ density, setDensity: setDensityState }),
    [density]
  );

  return (
    <DisplayDensityContext.Provider value={value}>
      {children}
    </DisplayDensityContext.Provider>
  );
}

export function useDisplayDensity(): DisplayDensityContextValue {
  const value = useContext(DisplayDensityContext);
  if (!value) throw new Error("useDisplayDensity must be used inside DisplayDensityProvider");
  return value;
}
