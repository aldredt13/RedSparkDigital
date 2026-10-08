import { createContext, useContext } from "react";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: "danger" | "default";
};

export const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(async () => false);

/** `if (!(await confirm({ title: "Delete?" }))) return;` */
export function useConfirm() {
  return useContext(ConfirmContext);
}
