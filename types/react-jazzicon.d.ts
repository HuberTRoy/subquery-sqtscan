// SPDX-License-Identifier: GNU-3.0

// https://github.com/marcusmolchany/react-jazzicon

declare module 'react-jazzicon' {
  import * as React from 'react';

  type JazziconProps = {
    diameter?: number;
    paperStyles?: React.CSSProperties;
    seed?: number;
    svgStyles?: React.CSSProperties;
  };

  const Jazzicon: React.FunctionComponent<JazziconProps>;

  export function jsNumberForAddress(address: string): number;

  export default Jazzicon;
}
