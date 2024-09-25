// SPDX-License-Identifier: GNU-3.0

export const getCapitalizedStr = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};
