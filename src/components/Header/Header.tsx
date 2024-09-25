// SPDX-License-Identifier: Apache-2.0

import * as React from 'react';
import { BiChart } from 'react-icons/bi';
import { useNavigate } from 'react-router-dom';
import { Header as SubqlHeader } from '@subql/components';

import styles from './Header.module.less';

export interface AppLink {
  label: string;
  link: string;
}

export interface DetailedLink {
  label: string;
  description: string;
  link: string;
}

export interface DropdownLink {
  label: string;
  links: DetailedLink[];
}

export interface AppNavigation {
  label: string;
  link?: string;
  dropdown?: AppLink[];
}

export const ScannerHeader: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className={styles.scannerHeader}>
      <SubqlHeader
        customLogo={
          <img src="/logo.svg" width="140px" style={{ cursor: 'pointer' }} onClick={() => navigate('/')}></img>
        }
        closeDrawerAfterNavigate
        navigate={(link) => {
          navigate(link);
        }}
        appNavigation={[
          {
            link: '/dashboard',
            // TODO: fix this type
            // @ts-ignore
            label: (
              <span className="flex" style={{ gap: 4 }}>
                <BiChart style={{ fontSize: 20 }} />
                Dashboard
              </span>
            ),
            active: () => {
              return window.location.pathname.includes('dashboard');
            },
          },
          {
            link: '/projects',
            // @ts-ignore
            label: (
              <span className="flex" style={{ gap: 4 }}>
                <BiChart style={{ fontSize: 20 }} />
                Project Deployment Rewards
              </span>
            ),
            active: () => {
              return window.location.pathname.includes('project-deployment-reward');
            },
          },
          {
            link: '/operators',
            // @ts-ignore
            label: (
              <span className="flex" style={{ gap: 4 }}>
                <BiChart style={{ fontSize: 20 }} />
                Node Operators
              </span>
            ),
            active: () => {
              return window.location.pathname.includes('operators');
            },
          },
        ]}
        active={(to) => {
          if (window.location.pathname.startsWith(to) || window.location.pathname.startsWith(`/${to}`)) return true;
          return false;
        }}
      ></SubqlHeader>
    </div>
  );
};
