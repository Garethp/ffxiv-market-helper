import { QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { createQueryClient } from "../queryClient";

/** A wrapper for rendering with a fresh query cache, so nothing fetched in one test is reused by the next. */
export const withQueryClient = () => {
  const queryClient = createQueryClient();
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
};
