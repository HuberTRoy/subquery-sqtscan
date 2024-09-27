import { FC, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router';
import { gql, useQuery } from '@apollo/client';
import { DeploymentInfo } from '@components/DeploymentInfo';
import { IndexerName } from '@components/IndexerDetails/IndexerName';
import { useConsumerHostServices } from '@hooks/useConsumerHostServices';
import { useEra } from '@hooks/useEra';
import { useSortedIndexerDeployments } from '@hooks/useSortedIndexerDeployments';
import { Typography } from '@subql/components';
import { useAsyncMemo } from '@subql/react-hooks';
import { formatNumber, formatSQT, TOKEN } from '@utils';
import { Breadcrumb, Button, Table } from 'antd';
import BigNumberJs from 'bignumber.js';
import clsx from 'clsx';
import dayjs from 'dayjs';

import { RewardsByType } from '../projectDetail/components/rewardsByType/rewardsByType';
import styles from './index.module.less';

interface IProps {}

const ScannerDashboard: FC<IProps> = (props) => {
  const { currentEra } = useEra();
  const { id } = useParams();
  const navigate = useNavigate();
  const { getStatisticQueries } = useConsumerHostServices({
    autoLogin: false,
  });

  const getIndexerRewardsInfos = useQuery<{
    eraIndexerApies: {
      nodes: {
        indexerId: string;
        indexerApy: string;
      }[];
    };
    eraIndexerDeploymentApies: {
      nodes: {
        apy: string;
        deploymentId: string;
      }[];
    };
    indexerEraDeploymentRewards: {
      groupedAggregates: {
        sum: {
          allocationRewards: string;
          queryRewards: string;
          totalRewards: string;
        };
        keys: string[];
      }[];
    };
  }>(
    gql`
      query getIndexerRewardsInfos($indexers: [String!], $era: Int!) {
        eraIndexerApies(filter: { eraIdx: { equalTo: $era }, indexerId: { in: $indexers } }) {
          nodes {
            indexerId
            indexerApy
          }
        }

        eraIndexerDeploymentApies(filter: { indexerId: { in: $indexers }, eraIdx: { equalTo: $era } }) {
          nodes {
            apy
            deploymentId
          }
        }

        indexerEraDeploymentRewards(filter: { indexerId: { in: $indexers } }) {
          groupedAggregates(groupBy: INDEXER_ID) {
            sum {
              allocationRewards
              queryRewards
              totalRewards
            }
            keys
          }
        }
      }
    `,
    {
      variables: {
        era: (currentEra.data?.index || 0) - 1,
        indexers: [id],
      },
    },
  );

  const indexerDeploymentsSorted = useSortedIndexerDeployments(id || '');

  const queriesOfIndexers = useAsyncMemo(async () => {
    if (!id || !currentEra.data?.index) {
      return { indexer: id, queries: '0' };
    }

    const selectEraInfo = currentEra.data?.eras?.at(1);

    const startDate = dayjs(selectEraInfo?.startTime || '0').format('YYYY-MM-DD');

    const endDate = selectEraInfo?.endTime ? dayjs(selectEraInfo?.endTime || '0').format('YYYY-MM-DD') : undefined;

    const queries = await getStatisticQueries({
      indexer: [id.toLowerCase()],
      start_date: startDate,
      end_date: endDate,
    });

    return queries.data.list?.[0] || { indexer: id, queries: '0' };
  }, [currentEra.data?.index, id]);

  const queriesOfDeployments = useAsyncMemo(async () => {
    if (!id || !currentEra.data?.index || !indexerDeploymentsSorted.data) {
      return [];
    }

    const selectEraInfo = currentEra.data?.eras?.at(1);

    const startDate = dayjs(selectEraInfo?.startTime || '0').format('YYYY-MM-DD');

    const endDate = selectEraInfo?.endTime ? dayjs(selectEraInfo?.endTime || '0').format('YYYY-MM-DD') : undefined;

    const queries = await getStatisticQueries({
      deployment: indexerDeploymentsSorted.data.map((item) => item.deploymentId || ''),
      indexer: [id.toLowerCase()],
      start_date: startDate,
      end_date: endDate,
    });

    return queries?.data?.list?.[0].list || [];
  }, [currentEra.data?.index, indexerDeploymentsSorted.data, id]);

  const getDeploymentQueries = useCallback(
    (deployment: string) => {
      if (Array.isArray(queriesOfDeployments.data)) {
        return queriesOfDeployments.data?.find((i) => i.deployment === deployment)?.queries || 0;
      }

      return 0;
    },
    [queriesOfDeployments.data],
  );

  const getApy = useCallback(
    (curDeploymentId: string) => {
      if (getIndexerRewardsInfos.data?.eraIndexerDeploymentApies?.nodes) {
        return BigNumberJs(
          formatSQT(
            getIndexerRewardsInfos.data?.eraIndexerDeploymentApies?.nodes?.find(
              (i) => i.deploymentId === curDeploymentId,
            )?.apy || '0',
          ),
        )
          .multipliedBy(100)
          .toFixed(2);
      }

      return '0';
    },
    [getIndexerRewardsInfos.data],
  );

  return (
    <div className={styles.dashboard}>
      <Breadcrumb
        className="darkBreadcrumb"
        items={[
          {
            key: 'explorer',
            title: (
              <Typography variant="medium" type="secondary" style={{ cursor: 'pointer' }}>
                Node Operators
              </Typography>
            ),
            onClick: () => {
              navigate(`/operators`);
            },
          },
          {
            key: 'current',
            title: (
              <Typography variant="medium" className="overflowEllipsis" style={{ maxWidth: 300 }}>
                {id}
              </Typography>
            ),
          },
        ]}
      ></Breadcrumb>

      <div className="flex" style={{ gap: 24 }}>
        <div className={clsx(styles.dashboardInner)} style={{ flex: 5, height: 426 }}>
          <div className="flex" style={{ marginBottom: 16 }}>
            <IndexerName address={id || ''} theme="dark" size="large"></IndexerName>
            <span style={{ flex: 1 }}></span>
            <Button type="primary" shape="round" size="large">
              <a href={`https://app.subquery.network/indexer/${id}`} target="_blank" rel="noreferrer">
                Open On Explorer
              </a>
            </Button>
          </div>

          <div className="col-flex" style={{ gap: 12 }}>
            <div className="flex gap32">
              <Typography type="secondary" style={{ width: 130 }}>
                Project Rewards
              </Typography>

              <Typography>
                {formatNumber(
                  formatSQT(
                    getIndexerRewardsInfos.data?.indexerEraDeploymentRewards?.groupedAggregates?.[0]?.sum
                      ?.totalRewards || '0',
                  ),
                )}{' '}
                {TOKEN}
              </Typography>
            </div>

            <div className="flex gap32">
              <Typography type="secondary" style={{ width: 130 }}>
                Projects
              </Typography>

              <Typography>{indexerDeploymentsSorted.data?.length || 0}</Typography>
            </div>

            <div className="flex gap32">
              <Typography type="secondary" style={{ width: 130 }}>
                Stake Rewards
              </Typography>

              <Typography>
                {formatNumber(
                  formatSQT(
                    getIndexerRewardsInfos.data?.indexerEraDeploymentRewards?.groupedAggregates?.[0]?.sum
                      ?.allocationRewards || '0',
                  ),
                )}{' '}
                {TOKEN}
              </Typography>
            </div>

            <div className="flex gap32">
              <Typography type="secondary" style={{ width: 130 }}>
                Query Rewards
              </Typography>

              <Typography>
                {formatNumber(
                  formatSQT(
                    getIndexerRewardsInfos.data?.indexerEraDeploymentRewards?.groupedAggregates?.[0]?.sum
                      ?.queryRewards || '0',
                  ),
                )}{' '}
                {TOKEN}
              </Typography>
            </div>

            <div className="flex gap32">
              <Typography type="secondary" style={{ width: 130 }}>
                Queries
              </Typography>

              <Typography>{formatNumber(BigNumberJs(queriesOfIndexers.data?.queries || '0').toFixed(0), 0)}</Typography>
            </div>
          </div>
        </div>
        <div style={{ flex: 8 }}>
          <RewardsByType indexerAddress={id}></RewardsByType>
        </div>
      </div>

      <div className={styles.dashboardInner}>
        <div className="flex" style={{ marginBottom: 24 }}>
          <Typography variant="large" weight={600}>
            Project Deployments({indexerDeploymentsSorted.data?.length || 0})
          </Typography>
        </div>

        <Table
          rowKey={(record, index) => record.deploymentId || index || '0'}
          className={clsx('darkTable', 'hoverRow')}
          loading={indexerDeploymentsSorted.loading}
          columns={[
            {
              title: 'Project deployment',
              dataIndex: 'name',
              key: 'name',
              render: (_, record) => {
                return (
                  <DeploymentInfo deploymentId={record.deploymentId} project={record.projectMeta}></DeploymentInfo>
                );
              },
            },
            {
              title: 'Allocation Stake',
              dataIndex: 'allocatedAmount',
              key: 'allocatedAmount',
              render: (text: string) => (
                <Typography>
                  {text ? formatNumber(formatSQT(text)) : 0} {TOKEN}
                </Typography>
              ),
              sorter: (a, b) => BigNumberJs(a.allocatedAmount || '0').comparedTo(b.allocatedAmount || '0'),
            },
            {
              title: 'Stake Rewards',
              dataIndex: 'lastEraAllocatedRewards',
              key: 'lastEraAllocatedRewards',
              render: (text: string) => (
                <Typography>
                  {text ? formatNumber(formatSQT(text)) : 0} {TOKEN}
                </Typography>
              ),
              sorter: (a, b) =>
                BigNumberJs(a.lastEraAllocatedRewards || '0').comparedTo(b.lastEraAllocatedRewards || '0'),
            },
            {
              title: 'STAKE Apy',
              dataIndex: 'deploymentId',
              key: 'deploymentId',
              render: (deploymentId: string) => <Typography>{getApy(deploymentId)}%</Typography>,
              sorter: (a, b) => BigNumberJs(getApy(a.deploymentId || '')).comparedTo(getApy(b.deploymentId || '')),
            },
            {
              title: 'Query Rewards',
              dataIndex: 'lastEraQueryRewards',
              key: 'lastEraQueryRewards',
              render: (text: string) => (
                <Typography>
                  {text ? formatNumber(formatSQT(text)) : 0} {TOKEN}
                </Typography>
              ),
              sorter: (a, b) => BigNumberJs(a.lastEraQueryRewards || '0').comparedTo(b.lastEraQueryRewards || '0'),
            },
            {
              title: 'Queries',
              dataIndex: 'deploymentId',
              key: 'deploymentId',
              render: (deploymentId: string) => (
                <Typography>{formatNumber(getDeploymentQueries(deploymentId), 0)}</Typography>
              ),
              sorter: (a, b) =>
                BigNumberJs(getDeploymentQueries(a.deploymentId || '')).comparedTo(
                  getDeploymentQueries(b.deploymentId || ''),
                ),
            },
            {
              title: 'Burnt Rewards',
              dataIndex: 'lastEraBurnt',
              key: 'lastEraBurnt',
              render: (text: string) => (
                <Typography>
                  {text ? formatNumber(formatSQT(text)) : '0.00'} {TOKEN}
                </Typography>
              ),
              sorter: (a, b) => BigNumberJs(a.lastEraBurnt || '0').comparedTo(b.lastEraBurnt || '0'),
            },
            {
              title: 'Total Rewards',
              dataIndex: 'totalRewards',
              key: 'totalRewards',
              render: (text: string) => (
                <Typography>
                  {text ? formatNumber(formatSQT(text)) : 0} {TOKEN}
                </Typography>
              ),
            },
          ]}
          dataSource={indexerDeploymentsSorted.data || []}
          pagination={false}
          onRow={(record) => {
            return {
              onClick: () => {
                navigate(
                  `/deployments/${record.deploymentId}?projectMetadata=${record.projectMetaCid}&projectId=${record.projectId}`,
                );
              },
            };
          }}
        ></Table>
      </div>
    </div>
  );
};

export default ScannerDashboard;
