import { createContext, useContext } from 'react';

/// Lets a page inside the Shell switch to another tab of the same role
/// (used by the User Manual's "Open this screen" buttons).
export const ShellNavContext = createContext({ goTo: () => {}, tabs: [], focus: null, clearFocus: () => {} });

export const useShellNav = () => useContext(ShellNavContext);
