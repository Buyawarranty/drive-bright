import React from 'react';

/**
 * Open Round Robin Sandbox flag.
 *
 * Any component under this provider is rendering PRACTICE data: it reads the
 * genuine live leads but must never write to them. `NewLeadsTab` uses this to
 * neutralise every mutating handler it passes down.
 */
const OrrSandboxContext = React.createContext(false);

export const OrrSandboxProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <OrrSandboxContext.Provider value={true}>{children}</OrrSandboxContext.Provider>
);

export const useIsOrrSandbox = () => React.useContext(OrrSandboxContext);

export default OrrSandboxContext;
