import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState
} from "react";

import {
  createDesktopPlatform,
  type DesktopPlatform
} from "./create-desktop-platform";

const PlatformContext = createContext<
  DesktopPlatform | undefined
>(undefined);

type PlatformState =
  | {
      status: "loading";
    }
  | {
      status: "ready";
      platform: DesktopPlatform;
    }
  | {
      status: "failed";
      error: unknown;
    };

export function PlatformProvider({
  children
}: PropsWithChildren) {
  const [state, setState] =
    useState<PlatformState>({
      status: "loading"
    });

  useEffect(() => {
    let disposed = false;
    let createdPlatform:
      DesktopPlatform | undefined;

    void createDesktopPlatform()
      .then((platform) => {
        createdPlatform = platform;

        if (disposed) {
          platform.stop();
          return;
        }

        platform.start();

        setState({
          status: "ready",
          platform
        });
      })
      .catch((error: unknown) => {
        if (!disposed) {
          setState({
            status: "failed",
            error
          });
        }
      });

    return () => {
      disposed = true;
      createdPlatform?.stop();
    };
  }, []);

  if (state.status === "loading") {
    return (
      <div lang="fa" dir="rtl">
        در حال آماده‌سازی زیرساخت برنامه…
      </div>
    );
  }

  if (state.status === "failed") {
    return (
      <div
        lang="fa"
        dir="rtl"
        role="alert"
      >
        راه‌اندازی زیرساخت محلی برنامه
        با خطا مواجه شد.
      </div>
    );
  }

  return (
    <PlatformContext.Provider
      value={state.platform}
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
