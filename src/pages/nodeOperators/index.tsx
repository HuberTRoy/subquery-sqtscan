import { FC, useEffect, useMemo, useState } from 'react';
import { IoSearch } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { IndexerName } from '@components/IndexerDetails/IndexerName';
import IndexerRewards from '@components/IndexerRewards';
import { useAsyncMemo } from '@hooks/useAsyncMemo';
import { useConsumerHostServices } from '@hooks/useConsumerHostServices';
import { useEra } from '@hooks/useEra';
import { CurrentEraValue, parseRawEraValue } from '@hooks/useEraValue';
import { useGetAllNodeOperators } from '@hooks/useGetAllNodeOperators';
import { Typography } from '@subql/components';
import { formatNumber, formatSQT, TOKEN } from '@utils';
import { Input, Select, Table } from 'antd';
import BigNumberJs from 'bignumber.js';
import dayjs from 'dayjs';
import { debounce } from 'lodash-es';

import styles from './index.module.less';

interface IProps {}

const ScannerDashboard: FC<IProps> = (props) => {
  const { currentEra } = useEra();
  const navigate = useNavigate();
  const { getStatisticQueries } = useConsumerHostServices({
    autoLogin: false,
  });
  const [selectEra, setSelectEra] = useState<number>((currentEra.data?.index || 1) - 1 || 0);
  const [searchNodeOperator, setSearchNodeOperator] = useState<string>('');
  // const debounceSearch = useMemo(() => debounce(setSearchNodeOperator, 500), [setSearchNodeOperator]);
  const [pageInfo, setPageInfo] = useState({
    pageSize: 30,
    currentPage: 1,
  });

  const blockHeightOfQuery = useMemo(() => {
    if (!currentEra.data?.index) return '99999999999999999';

    if (selectEra === currentEra.data.index - 1 || selectEra === currentEra.data.index) {
      return '99999999999999999';
    }

    return currentEra.data.eras?.find((i) => parseInt(i.id, 16) === selectEra)?.createdBlock || '99999999999999999';
  }, [selectEra, currentEra.data?.index]);

  const { allNodeOperators, allNodeOperatorInformations, loading } = useGetAllNodeOperators({
    selectEra,
  });

  const queriesOfAllIndexers = useAsyncMemo(async () => {
    if (!allNodeOperators?.nodes.length || !currentEra.data?.index) {
      return [];
    }

    const selectEraInfo = currentEra.data?.eras?.find((i) => parseInt(i.id, 16) === selectEra);

    const startDate = dayjs(selectEraInfo?.startTime || '0').format('YYYY-MM-DD');

    const endDate = selectEraInfo?.endTime ? dayjs(selectEraInfo?.endTime || '0').format('YYYY-MM-DD') : undefined;

    const queries = await getStatisticQueries({
      indexer: allNodeOperators?.nodes.map((node) => node.id.toLowerCase()) || [],
      start_date: startDate,
      end_date: endDate,
    });

    return queries?.data?.list;
  }, [currentEra.data?.index, allNodeOperators?.nodes, selectEra]);

  const renderData = useMemo(() => {
    if (loading || !allNodeOperators?.nodes.length || !allNodeOperatorInformations) {
      return [];
    }

    const indexerRewardsMap = allNodeOperatorInformations.indexerEraDeploymentRewards.groupedAggregates.reduce(
      (acc, cur) => {
        acc[cur.keys[0]] = cur.sum;
        return acc;
      },
      {} as Record<string, { allocationRewards: string; queryRewards: string; totalRewards: string }>,
    );

    return allNodeOperators?.nodes
      .map((indexer) => {
        const indexerRewards = indexerRewardsMap[indexer.id];
        const apy = allNodeOperatorInformations?.eraIndexerApies.nodes.find(
          (node) => node.indexerId === indexer.id,
        )?.indexerApy;

        const totalStake = parseRawEraValue(indexer.totalStake, selectEra).current.toString();
        const selfStake = parseRawEraValue(indexer.selfStake, selectEra).current.toString();
        const queries = queriesOfAllIndexers.data?.find((i) => i.indexer?.toLowerCase() === indexer.id.toLowerCase());

        return {
          ...indexer,
          rawTotalStake: totalStake,
          totalStake: formatNumber(formatSQT(totalStake || '0')),
          rawSelfStake: selfStake,
          selfStake: formatNumber(formatSQT(selfStake || '0')),
          delegationStake: formatNumber(formatSQT(BigNumberJs(totalStake).minus(selfStake).toString())),
          rawDelegationStake: BigNumberJs(totalStake).minus(selfStake).toString(),
          allocationRewards: formatNumber(formatSQT(BigNumberJs(indexerRewards?.allocationRewards || 0).toString())),
          rawAllocationRewards: BigNumberJs(indexerRewards?.allocationRewards || 0).toString(),
          queryRewards: formatNumber(formatSQT(BigNumberJs(indexerRewards?.queryRewards || 0).toString())),
          rawQueryRewards: BigNumberJs(indexerRewards?.queryRewards || 0).toString(),
          queries: BigNumberJs(queries?.queries || 0).toFixed(0),
          apy: BigNumberJs(formatSQT(apy || '0'))
            .multipliedBy(100)
            .toFixed(2),
        };
      })
      .filter((i) => i.id.toLowerCase().includes(searchNodeOperator.toLowerCase()));
  }, [allNodeOperators, allNodeOperatorInformations, selectEra, queriesOfAllIndexers, loading, searchNodeOperator]);

  useEffect(() => {
    if (currentEra.data?.index) {
      setSelectEra(currentEra.data?.index - 1);
    }
  }, [currentEra.data?.index]);

  return (
    <div className={styles.dashboard}>
      <div className={styles.dashboardInner}>
        <div className="flex" style={{ marginBottom: 24 }}>
          <Typography variant="large" weight={600}>
            Node Operators ({allNodeOperators?.totalCount})
          </Typography>
        </div>

        <div className="flex" style={{ marginBottom: 24, gap: 24 }}>
          <Select
            className="darkSelector"
            style={{ width: 200 }}
            value={selectEra}
            //Add options to select previous eras
            //Order: Current Era, Previous Era 1, Previous Era 2, ...
            options={[
              { label: `Current Era ${currentEra.data?.index}`, value: currentEra.data?.index }, // Thêm giá trị currentEra lên đầu
              ...new Array(currentEra.data?.index || 0).fill(0).map((_, index, arr) => ({
                label: `Previous Era ${arr.length - 1 - index}`,
                value: arr.length - 1 - index,
              })),
            ]}
            onChange={(value) => {
              setSelectEra(value);
            }}
            loading={currentEra.loading}
          ></Select>
          <Input
            className="darkInput"
            style={{ width: 342 }}
            placeholder="Search by address"
            prefix={<IoSearch />}
            onChange={(e) => {
              setSearchNodeOperator(e.target.value);
            }}
          ></Input>
        </div>

        <div className={styles.dashboard} style={{ padding: '0px', paddingBottom: '24px' }}>
          <div className={styles.dashboardInner}>
            <IndexerRewards era={selectEra} indexerId={searchNodeOperator} />
          </div>
        </div>

        <Table
          rowKey={(record) => record.id}
          className={'darkTable'}
          loading={loading}
          columns={[
            {
              title: 'Node Operators',
              dataIndex: 'name',
              key: 'name',
              render: (_, record) => {
                return (
                  <IndexerName
                    theme="dark"
                    address={record.id}
                    onClick={() => {
                      navigate(`/operators/${record.id}`);
                    }}
                  />
                );
              },
            },
            {
              title: 'apy',
              dataIndex: 'apy',
              key: 'apy',
              render: (text: string) => <Typography>{text} %</Typography>,
              sorter: (a, b) => BigNumberJs(a.apy).comparedTo(b.apy),
            },
            {
              title: 'Stake',
              dataIndex: 'totalStake',
              key: 'totalStake',
              render: (text: string) => (
                <Typography>
                  {text} {TOKEN}
                </Typography>
              ),
              sorter: (a, b) => BigNumberJs(a.rawTotalStake).comparedTo(b.rawTotalStake),
            },
            {
              title: 'Self Stake',
              dataIndex: 'selfStake',
              key: 'selfStake',
              render: (text: string) => (
                <Typography>
                  {text} {TOKEN}
                </Typography>
              ),
              sorter: (a, b) => BigNumberJs(a.rawSelfStake).comparedTo(b.rawSelfStake),
            },
            {
              title: 'Delegation',
              dataIndex: 'delegationStake',
              key: 'delegationStake',
              render: (text: string) => (
                <Typography>
                  {text} {TOKEN}
                </Typography>
              ),
              sorter: (a, b) => BigNumberJs(a.rawDelegationStake).comparedTo(b.rawDelegationStake),
            },
            {
              title: 'Queries',
              dataIndex: 'queries',
              key: 'queries',
              render: (text: string) => <Typography>{formatNumber(text, 0)}</Typography>,
              sorter: (a, b) => BigNumberJs(a.queries).comparedTo(b.queries),
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
              sorter: (a, b) => BigNumberJs(a.rawQueryRewards).comparedTo(b.rawQueryRewards),
            },
            {
              title: 'Stake Rewards',
              dataIndex: 'allocationRewards',
              key: 'allocationRewards',
              render: (text: string) => (
                <Typography>
                  {text} {TOKEN}
                </Typography>
              ),
              sorter: (a, b) => BigNumberJs(a.rawAllocationRewards).comparedTo(b.rawAllocationRewards),
            },
          ]}
          dataSource={renderData}
          pagination={{
            total: renderData.length,
            pageSize: pageInfo.pageSize,
            pageSizeOptions: ['10', '30', '50', '100'],
            current: pageInfo.currentPage,
            onChange(page, pageSize) {
              setPageInfo({
                pageSize,
                currentPage: page,
              });
            },
          }}
        ></Table>
      </div>
    </div>
  );
};
export default ScannerDashboard;
