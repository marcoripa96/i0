"use client";

import {
  createContext,
  useContext,
  useTransition,
  type TransitionStartFunction,
} from "react";

type SearchTransitionContextType = {
  isPending: boolean;
  startTransition: TransitionStartFunction;
};

const SearchTransitionContext = createContext<SearchTransitionContextType>({
  isPending: false,
  startTransition: () => {},
});

export function SearchTransitionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <SearchTransitionContext.Provider value={{ isPending, startTransition }}>
      {children}
    </SearchTransitionContext.Provider>
  );
}

export function useSearchTransition() {
  return useContext(SearchTransitionContext);
}
