import React, { FC, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { gql, useQuery } from '@apollo/client';
import { DeploymentMeta } from '@components/DeploymentInfo';
import { useConsumerHostServices } from '@hooks/useConsumerHostServices';
import { useEra } from '@hooks/useEra';
import { useGetAllDeployment } from '@hooks/useGetAllDeployment';
import { Typography } from '@subql/components';
import { useAsyncMemo } from '@subql/react-hooks';
import { formatNumber, formatSQT, TOKEN } from '@utils';
import { Button, Table } from 'antd';
import BigNumberJs from 'bignumber.js';
import clsx from 'clsx';
import dayjs from 'dayjs';

import { OperatorRewardsLineChart } from './components/operatorRewardsChart/OperatorRewardsLineChart';
import styles from './index.module.less';

interface IProps {}

const ScannerDashboard: FC<IProps> = (props) => {
  const { currentEra } = useEra();
  const navigate = useNavigate();
  const { getStatisticQueries } = useConsumerHostServices({
    autoLogin: false,
  });

  const { allDeployments, allDeploymentsInfomations, loading } = useGetAllDeployment({
    selectEra: (currentEra.data?.index || 1) - 1,
  });

  const queries = useAsyncMemo(async () => {
    if (!currentEra.data) return [];
    const deployments = allDeployments?.nodes.map((i) => i.deploymentId);
    if (!deployments || !deployments?.length) return [];
    try {
      const res = await getStatisticQueries({
        deployment: deployments,
        start_date: dayjs(currentEra.data.eras?.at(1)?.startTime).format('YYYY-MM-DD'),
        end_date: dayjs(currentEra.data.eras?.at(1)?.endTime).format('YYYY-MM-DD'),
      });

      return res.data.list;
    } catch (e) {
      return [];
    }
  }, [allDeployments, currentEra.data?.eras]);

  const renderData = useMemo(() => {
    if (loading) return [];

    return allDeployments?.nodes
      .map((node, index) => {
        const eraDeploymentRewardsItem = allDeploymentsInfomations?.eraDeploymentRewards.groupedAggregates.find(
          (i) => i.keys[0] === node.deploymentId,
        );
        const allocationRewards = eraDeploymentRewardsItem?.sum.allocationRewards || '0';
        const totalCount = allDeploymentsInfomations?.deployments.nodes.find((i) => i.id === node.deploymentId)
          ?.indexers.totalCount;

        const totalAllocation =
          allDeploymentsInfomations?.indexerAllocationSummaries.groupedAggregates.find(
            (i) => i.keys[0] === node.deploymentId,
          )?.sum.totalAmount || '0';
        const totalQueryRewards = BigNumberJs(eraDeploymentRewardsItem?.sum.totalRewards || '0')
          .minus(allocationRewards)
          .toFixed();
        const deploymentInfo = allDeploymentsInfomations?.deployments.nodes.find((i) => i.id === node.deploymentId);

        const deploymentQueryCount = queries.data?.find((i) => i.deployment === node.deploymentId);

        const apy = BigNumberJs(allocationRewards)
          .div(totalAllocation === '0' ? '1' : totalAllocation)
          .multipliedBy(52)
          .multipliedBy(100);

        return {
          deploymentId: node.deploymentId,
          projectMetadata: deploymentInfo?.project.metadata,
          operatorCount: totalCount,
          allocationAmount: formatNumber(formatSQT(totalAllocation)),
          boosterAmount: formatNumber(
            formatSQT(
              allDeploymentsInfomations?.deploymentBoosterSummaries.groupedAggregates.find(
                (i) => i.keys[0] === node.deploymentId,
              )?.sum.totalAmount || '0',
            ),
          ),
          allocationRewards: formatNumber(formatSQT(allocationRewards)),
          averageAllocationRewards: formatNumber(
            formatSQT(
              BigNumberJs(allocationRewards)
                .div(totalCount || 1)
                .toFixed(),
            ),
          ),
          allocationApy: apy.gt(1000) ? '1000+' : apy.toFixed(2),
          queryRewards: formatNumber(formatSQT(totalQueryRewards)),
          averageQueryRewards: formatNumber(
            formatSQT(
              BigNumberJs(totalQueryRewards)
                .div(totalCount || 1)
                .toFixed(),
            ),
          ),
          queries: formatNumber(deploymentQueryCount?.queries || 0, 0),
          averageQueries: formatNumber(
            BigNumberJs(deploymentQueryCount?.queries || 0)
              .div(totalCount || 1)
              .toFixed(),
            0,
          ),
          totalRewards: formatNumber(formatSQT(eraDeploymentRewardsItem?.sum.totalRewards || '0')),
          averageRewards: formatNumber(
            formatSQT(
              BigNumberJs(eraDeploymentRewardsItem?.sum.totalRewards || '0')
                .div(totalCount || 1)
                .toFixed(),
            ),
          ),
          rawAverageRewards: BigNumberJs(eraDeploymentRewardsItem?.sum.totalRewards || '0')
            .div(totalCount || 1)
            .toFixed(),
        };
      })
      .sort((a, b) => BigNumberJs(b.rawAverageRewards).comparedTo(a.rawAverageRewards))
      .slice(0, 5);
  }, [allDeployments, allDeploymentsInfomations, queries, loading]);

  return (
    <div className={styles.dashboard}>
      <Typography variant="h5" weight={600}>
        Dashboard
      </Typography>
      <OperatorRewardsLineChart></OperatorRewardsLineChart>
      <div className={styles.dashboardInner}>
        <div className="flex" style={{ marginBottom: 24 }}>
          <Typography variant="large" weight={600}>
            Top 5 Project Deployment Rewards{' '}
            {currentEra.data?.index ? `(Previous Era ${currentEra.data?.index - 1})` : ''}
          </Typography>
          <span style={{ flex: 1 }}></span>
          <Button type="primary" shape="round">
            <Link to="/deployments">View All Projects</Link>
          </Button>
        </div>

        <Table
          rowKey={(record) => record.deploymentId}
          className={clsx('darkTable', 'hoverRow')}
          loading={loading}
          columns={[
            {
              title: 'Project',
              dataIndex: 'name',
              key: 'name',
              render: (_, record) => {
                return <DeploymentMeta deploymentId={record.deploymentId} projectMetadata={record.projectMetadata} />;
              },
            },
            {
              title: 'Node Operators',
              dataIndex: 'operatorCount',
              key: 'operatorCount',
            },
            {
              title: 'Stake',
              dataIndex: 'allocationAmount',
              key: 'allocationAmount',
              render: (text: string) => (
                <Typography>
                  {text} {TOKEN}
                </Typography>
              ),
            },
            {
              title: 'Boost',
              dataIndex: 'boosterAmount',
              key: 'boosterAmount',
              render: (text: string) => (
                <Typography>
                  {text} {TOKEN}
                </Typography>
              ),
            },
            {
              title: 'Total Stake Rewards',
              dataIndex: 'allocationRewards',
              key: 'allocationRewards',
              render: (text: string) => (
                <Typography>
                  {text} {TOKEN}
                </Typography>
              ),
            },
            {
              title: 'Average Stake Rewards',
              dataIndex: 'averageAllocationRewards',
              key: 'averageAllocationRewards',
              render: (text: string) => (
                <Typography>
                  {text} {TOKEN}
                </Typography>
              ),
            },
            {
              title: 'Stake Apy',
              dataIndex: 'allocationApy',
              key: 'allocationApy',
              render: (text: string) => <Typography>{text} %</Typography>,
            },
            {
              title: 'Total Queries',
              dataIndex: 'queries',
              key: 'queries',
              render: (text: string) => <Typography>{text}</Typography>,
            },
            {
              title: 'Average Queries',
              dataIndex: 'averageQueries',
              key: 'averageQueries',
              render: (text: string) => <Typography>{text}</Typography>,
            },
            {
              title: 'Total Query Rewards',
              dataIndex: 'queryRewards',
              key: 'queryRewards',
              render: (text: string) => (
                <Typography>
                  {text} {TOKEN}
                </Typography>
              ),
            },
            {
              title: 'Average Query Rewards',
              dataIndex: 'averageQueryRewards',
              key: 'averageQueryRewards',
              render: (text: string) => (
                <Typography>
                  {text} {TOKEN}
                </Typography>
              ),
            },
            {
              title: 'Total Rewards',
              dataIndex: 'totalRewards',
              key: 'totalRewards',
              render: (text: string) => (
                <Typography>
                  {text} {TOKEN}
                </Typography>
              ),
            },
            {
              title: 'Average Rewards',
              dataIndex: 'averageRewards',
              key: 'averageRewards',
              render: (text: string) => (
                <Typography>
                  {text} {TOKEN}
                </Typography>
              ),
            },
          ]}
          onRow={(record) => {
            return {
              onClick: () => {
                navigate(`/deployments/${record.deploymentId}?projectMetadata=${record.projectMetadata}`);
              },
            };
          }}
          dataSource={renderData}
          pagination={false}
          scroll={{ x: 'max-content' }}
        ></Table>
      </div>
    </div>
  );
};

export default ScannerDashboard;
