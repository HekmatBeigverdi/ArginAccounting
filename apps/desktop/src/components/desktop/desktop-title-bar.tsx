import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

import "./desktop-title-bar.css";

export function DesktopTitleBar() {
  const [maximized, setMaximized] = useState(false);
  const nativeWindowAvailable = isTauri();

  useEffect(() => {
    if (!nativeWindowAvailable) return;

    const appWindow = getCurrentWindow();
    let disposed = false;

    void appWindow.isMaximized().then((value) => {
      if (!disposed) setMaximized(value);
    });

    const unlistenPromise = appWindow.onResized(() => {
      void appWindow.isMaximized().then((value) => {
        if (!disposed) setMaximized(value);
      });
    });

    return () => {
      disposed = true;
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, [nativeWindowAvailable]);

  if (!nativeWindowAvailable) return null;

  const appWindow = getCurrentWindow();

  async function toggleMaximize(): Promise<void> {
    await appWindow.toggleMaximize();
    setMaximized(await appWindow.isMaximized());
  }

  return (
    <div
      className="desktop-titlebar"
      data-tauri-drag-region
      onDoubleClick={() => void toggleMaximize()}
    >
      <div className="desktop-titlebar__identity" data-tauri-drag-region>
        <strong data-tauri-drag-region>ArginAccounting</strong>
        <span data-tauri-drag-region>نرم‌افزار حسابداری شرکتی آرگین</span>
      </div>

      <div
        className="desktop-titlebar__controls"
        role="group"
        aria-label="کنترل پنجره"
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="desktop-titlebar__button"
          aria-label="کمینه کردن پنجره"
          title="Minimize"
          onClick={() => void appWindow.minimize()}
        >
          <span aria-hidden="true">—</span>
        </button>

        <button
          type="button"
          className="desktop-titlebar__button"
          aria-label={maximized ? "بازگردانی اندازه پنجره" : "بزرگ کردن پنجره"}
          title={maximized ? "Restore" : "Maximize"}
          onClick={() => void toggleMaximize()}
        >
          <span className={maximized ? "desktop-titlebar__restore-icon" : "desktop-titlebar__maximize-icon"} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="desktop-titlebar__button desktop-titlebar__button--close"
          aria-label="بستن پنجره"
          title="Close"
          onClick={() => void appWindow.close()}
        >
          <span aria-hidden="true">×</span>
        </button>
      </div>
    </div>
  );
}
