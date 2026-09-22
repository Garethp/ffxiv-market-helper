import type { ReactNode } from "react";

/** Something that went wrong, worded for the user and announced when it appears. */
export const ErrorMessage = ({ children }: { children: ReactNode }) => (
  <p role="alert" className="form-error">
    {children}
  </p>
);
