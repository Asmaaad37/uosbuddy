"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type Ask = { title: string; body?: string; action: string };
const ConfirmContext = createContext<(ask: Ask) => Promise<boolean>>(async () => true);

/** `await confirm({...})` before anything a mis-tap could destroy. True means go ahead. */
export const useConfirm = () => useContext(ConfirmContext);

/** One shared dialog for the whole app, so each action needs only one line. */
export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [ask, setAsk] = useState<Ask | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback(
    (next: Ask) =>
      new Promise<boolean>((resolve) => {
        resolver.current?.(false);
        resolver.current = resolve;
        setAsk(next);
      }),
    [],
  );

  function close(ok: boolean) {
    resolver.current?.(ok);
    resolver.current = null;
    setAsk(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={!!ask} onOpenChange={(open) => !open && close(false)}>
        <DialogContent>
          <DialogTitle>{ask?.title}</DialogTitle>
          {ask?.body && <DialogDescription>{ask.body}</DialogDescription>}
          <div className="mt-2 grid gap-2">
            <Button variant="destructive" block onClick={() => close(true)}>
              {ask?.action}
            </Button>
            <Button variant="quiet" block onClick={() => close(false)}>
              Keep it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}
