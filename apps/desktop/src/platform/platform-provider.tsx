import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect
} from "react";

import {
  createDesktopPlatform,
  type DesktopPlatform
} from "./create-desktop-platform";

const desktopPlatform =
  createDesktopPlatform();

const PlatformContext = createContext<
  DesktopPlatform | undefined
>(undefined);

export function PlatformProvider({
  children
}: PropsWithChildren) {
  useEffect(() => {
    desktopPlatform.start();

    return () => {
      desktopPlatform.stop();
    };
  }, []);

  return (
    <PlatformContext.Provider
      value={desktopPlatform}
    >
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform():
  DesktopPlatform {
  const platform =
    useContext(PlatformContext);

  if (platform === undefined) {
    throw new Error(
      "usePlatform must be used inside PlatformProvider."
    );
  }

  return platform;
}
