// SPDX-License-Identifier: Apache-2.0

import React, { FC, LazyExoticComponent } from 'react';

export type BasicRouteType = {
  path: string;
  component?: LazyExoticComponent<FC>;
  redirect?: string;
  children?: BasicRouteType[];
};

export const scannerRouters: BasicRouteType[] = [
  { path: '/', redirect: '/dashboard' },
  { path: '/dashboard', component: React.lazy(() => import('../pages/dashboard/index')) },
  {
    path: '/project-deployment-rewards',
    component: React.lazy(() => import('../pages/projectDeploymentRewards/index')),
  },
  {
    path: '/project-deployment-rewards/:id',
    component: React.lazy(() => import('../pages/projectDetail/index')),
  },
  {
    path: '/node-operators',
    component: React.lazy(() => import('../pages/nodeOperators/index')),
  },
  {
    path: '/node-operator/:id',
    component: React.lazy(() => import('../pages/nodeOperatorDetail/index')),
  },
];
