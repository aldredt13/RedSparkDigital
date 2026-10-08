import { useCallback, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { ConfirmContext, type ConfirmOptions } from "./confirm-context";
import { Button, Modal } from "./ui";

/** Replaces window.confirm() with an on-brand dialog. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<(ok: boolean) => void>(() => {});

  const confirm = useCallback((opts: ConfirmOptions) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const settle = (ok: boolean) => {
    resolver.current(ok);
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <Modal
          title={options.title}
          onClose={() => settle(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => settle(false)}>
                Cancel
              </Button>
              <Button variant={options.tone === "danger" ? "dangerSolid" : "primary"} onClick={() => settle(true)} autoFocus>
                {options.confirmLabel ?? "Confirm"}
              </Button>
            </>
          }
        >
          <div className="flex gap-4">
            {options.tone === "danger" && (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </span>
            )}
            <p className="text-sm leading-relaxed text-muted-foreground">{options.description ?? "Are you sure?"}</p>
          </div>
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}
