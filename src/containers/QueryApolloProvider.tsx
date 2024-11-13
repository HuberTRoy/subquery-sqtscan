// Copyright 2020-2022 SubQuery Pte Ltd authors & contributors
// SPDX-License-Identifier: Apache-2.0

import React, { PropsWithChildren } from 'react';
import { ApolloClient, ApolloLink, ApolloProvider, HttpLink, InMemoryCache } from '@apollo/client';
import { Observable, offsetLimitPagination } from '@apollo/client/utilities';

const getHttpLink = (uri: string | undefined) => new HttpLink({ uri });

export const TOP_100_INDEXERS = 'top100Indexers';
const top100IndexersLink = getHttpLink(import.meta.env.VITE_TOP_100_INDEXERS);

const gatewayLink = getHttpLink(
  `${import.meta.env.VITE_PROXYGATEWAY}/query/${import.meta.env.VITE_NETWORK_DEPLOYMENT_ID}`,
);
const fallbackLink = getHttpLink(import.meta.env.VITE_QUERY_REGISTRY_PROJECT);

export const networkLink = new ApolloLink((operation) => {
  return new Observable((observer) => {
    gatewayLink.request(operation)?.subscribe({
      next(value) {
        observer.next(value);
        observer.complete();
      },
      error: () => {
        fallbackLink.request(operation)?.subscribe({
          next(value) {
            observer.next(value);
            observer.complete();
          },
          error: (error) => {
            observer.error(error);
          },
        });
      },
    });
  });
});

const links = ApolloLink.from([
  ApolloLink.split(
    (operation) => operation.getContext().clientName === TOP_100_INDEXERS,
    top100IndexersLink,
    networkLink,
  ),
]);

export const QueryApolloProvider: React.FC<PropsWithChildren> = ({ children }) => {
  const client = new ApolloClient({
    link: links,
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            nodes: offsetLimitPagination(), // XXX untested
          },
        },
      },
    }),
    defaultOptions: {
      query: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'all',
      },
      watchQuery: {
        fetchPolicy: 'no-cache',
        errorPolicy: 'ignore',
      },
    },
  });

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
};
