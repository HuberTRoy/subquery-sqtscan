import React, { FC, useEffect, useMemo, useState } from 'react';
import { IoSearch } from 'react-icons/io5';
import { useNavigate } from 'react-router';
import { DeploymentMeta } from '@components/DeploymentInfo';
import IndexerRewards from '@components/IndexerRewards';
import { useConsumerHostServices } from '@hooks/useConsumerHostServices';
import { useEra } from '@hooks/useEra';
import { useGetAllDeployment } from '@hooks/useGetAllDeployment';
import { Typography } from '@subql/components';
import { useAsyncMemo } from '@subql/react-hooks';
import { formatNumber, formatSQT, TOKEN } from '@utils';
import { Input, Radio, Select, Table, Tooltip } from 'antd';
import BigNumberJs from 'bignumber.js';
import clsx from 'clsx';
import dayjs from 'dayjs';
import { parseEther } from 'ethers/lib/utils';
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
  const [pageInfo, setPageInfo] = useState({
    pageSize: 30,
    currentPage: 1,
  });
  const [calcInput, setCalcInput] = useState<number>(100000);
  const [rowSelected, setRowSelected] = useState<{ deploymentId: string }>();
  const [statisticGroup, setStatisticGroup] = useState<'averageRewards' | 'projectedRewards'>('averageRewards');
  const [searchDeployment, setSearchDeployment] = useState<string>('');
  const debounceSearch = useMemo(() => debounce(setSearchDeployment, 500), [setSearchDeployment]);

  const { allDeployments, allDeploymentsInfomations, loading } = useGetAllDeployment({
    selectEra,
  });

  const queries = useAsyncMemo(async () => {
    if (!currentEra.data) return [];
    const deployments = allDeployments?.nodes.map((i) => i.deploymentId);
    if (!deployments || !deployments?.length) return [];
    const selectedEra = currentEra.data?.eras?.find((i) => parseInt(i.id, 16) === selectEra);
    try {
      const res = await getStatisticQueries({
        deployment: deployments,
        start_date: dayjs(selectedEra?.startTime).format('YYYY-MM-DD'),
        end_date: selectedEra?.endTime ? dayjs(selectedEra?.endTime).format('YYYY-MM-DD') : undefined,
      });

      return res.data.list;
    } catch (e) {
      return [];
    }
  }, [allDeployments, selectEra]);

  const renderData = useMemo(() => {
    if (selectEra === 0) return [];
    if (loading) return [];

    if (!allDeployments?.nodes.length) return [];

    return allDeployments?.nodes
      .map((node) => {
        const inputStake = BigNumberJs(calcInput).gt(100000000) ? '100000000' : calcInput;
        const eraDeploymentRewardsItem = allDeploymentsInfomations?.eraDeploymentRewards.groupedAggregates.find(
          (i) => i.keys[0] === node.deploymentId,
        );

        const rawTotalStake = BigNumberJs(
          allDeploymentsInfomations?.indexerAllocationSummaries.groupedAggregates.find(
            (i) => i.keys[0] === node.deploymentId,
          )?.sum.totalAmount || '0',
        );

        const rawTotalRewards = BigNumberJs(eraDeploymentRewardsItem?.sum.allocationRewards || '0');

        const estimatedRewardsOfInputStake = rawTotalRewards.multipliedBy(
          BigNumberJs(parseEther(inputStake.toString()).toString()).div(
            rawTotalStake.plus(parseEther(inputStake.toString()).toString()),
          ),
        );

        const totalCount =
          (allDeploymentsInfomations?.deployments.nodes.find((i) => i.id === node.deploymentId)?.indexers.totalCount ||
            0) + (statisticGroup === 'averageRewards' ? 0 : 1);

        const totalAllocation = rawTotalStake
          .plus(statisticGroup === 'averageRewards' ? 0 : parseEther(inputStake.toString()).toString())
          .toString();

        const allocationRewards =
          statisticGroup === 'projectedRewards'
            ? estimatedRewardsOfInputStake.isNaN()
              ? '0'
              : estimatedRewardsOfInputStake.toString()
            : eraDeploymentRewardsItem?.sum.allocationRewards || '0';

        const totalQueryRewards = BigNumberJs(eraDeploymentRewardsItem?.sum.totalRewards || '0')
          .minus(eraDeploymentRewardsItem?.sum.allocationRewards || '0')
          .toFixed();
        const deploymentInfo = allDeploymentsInfomations?.deployments.nodes.find((i) => i.id === node.deploymentId);
        const allocationApy = BigNumberJs(allocationRewards || 0)
          .div(statisticGroup === 'averageRewards' ? totalAllocation : parseEther(inputStake.toString()).toString())
          .multipliedBy(52)
          .multipliedBy(100);

        const deploymentQueryCount = queries.data?.find((i) => i.deployment === node.deploymentId);

        const averageQueryRewards = BigNumberJs(totalQueryRewards)
          .div(totalCount || 1)
          .toFixed();
        return {
          deploymentId: node.deploymentId,
          projectMetadata: deploymentInfo?.project.metadata,
          projectId: deploymentInfo?.project.id,
          operatorCount: totalCount,
          rawAllocationAmount: totalAllocation,
          rawAllocationRewards: allocationRewards,
          rawBooster: formatSQT(
            allDeploymentsInfomations?.deploymentBoosterSummaries.groupedAggregates.find(
              (i) => i.keys[0] === node.deploymentId,
            )?.sum.totalAmount || '0',
          ),
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
          allocationApy: allocationApy.isNaN() ? '0.00' : allocationApy.gt(1000) ? 'N/A' : allocationApy.toFixed(2),
          rawAllocationApy: allocationApy.isNaN() ? '0.00' : allocationApy.gt(1000) ? '0' : allocationApy.toFixed(2),
          queryRewards: formatNumber(formatSQT(totalQueryRewards)),
          averageQueryRewards: formatNumber(formatSQT(averageQueryRewards)),
          rawAverageQueryRewards: formatSQT(averageQueryRewards),
          rawTotalRewards: formatSQT(BigNumberJs(allocationRewards).plus(totalQueryRewards).toString()),
          totalRewards: formatNumber(
            formatSQT(
              BigNumberJs(allocationRewards)
                .plus(statisticGroup === 'averageRewards' ? totalQueryRewards : averageQueryRewards)
                .toString(),
            ),
          ),
          averageRewards: formatNumber(
            formatSQT(
              BigNumberJs(eraDeploymentRewardsItem?.sum.totalRewards || '0')
                .div(totalCount || 1)
                .toFixed(),
            ),
          ),
          rawAverageRewards: formatSQT(
            BigNumberJs(eraDeploymentRewardsItem?.sum.totalRewards || '0')
              .div(totalCount || 1)
              .toFixed(),
          ),
          averageQueriesCount: formatNumber(
            BigNumberJs(deploymentQueryCount?.queries || '0')
              .div(totalCount || 1)
              .toString(),
            0,
          ),
          rawAverageQueriesCount: BigNumberJs(deploymentQueryCount?.queries || '0')
            .div(totalCount || 1)
            .toString(),
        };
      })
      .filter((i) => i.deploymentId.toLowerCase().includes(searchDeployment.toLowerCase()))
      .sort((a, b) => {
        if (statisticGroup === 'averageRewards') {
          return BigNumberJs(b.rawAverageRewards).comparedTo(a.rawAverageRewards);
        }
        return BigNumberJs(b.rawTotalRewards).comparedTo(a.rawTotalRewards);
      });
  }, [
    loading,
    allDeployments,
    allDeploymentsInfomations,
    calcInput,
    statisticGroup,
    queries.data,
    searchDeployment,
    selectEra,
  ]);

  const estimatedStakeRewards = useMemo(() => {
    const selectedRow = renderData?.find((i) => i.deploymentId === rowSelected?.deploymentId);
    if (!selectedRow) {
      return 0;
    }

    const { rawAllocationAmount, rawAllocationRewards } = selectedRow;
    if (BigNumberJs(rawAllocationAmount).isZero()) {
      return 0;
    }
    const oneTokenRewards = BigNumberJs(rawAllocationRewards).div(
      rawAllocationAmount === '0' ? 1 : rawAllocationAmount,
    );
    const result = oneTokenRewards.multipliedBy(calcInput).toFixed(6);
    if (isNaN(+result)) {
      return '0.000000';
    }
    return result;
  }, [rowSelected, calcInput]);

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
            Project Deployment Rewards
          </Typography>
        </div>

        <div className="flex" style={{ marginBottom: 24, gap: 24 }}>
          <Radio.Group
            className="darkRadioGroup"
            options={[
              { label: 'Previous Average Rewards', value: 'averageRewards' },
              { label: 'Projected Rewards', value: 'projectedRewards' },
            ]}
            onChange={(val) => {
              setStatisticGroup(val.target.value);
            }}
            value={statisticGroup}
            optionType="button"
            buttonStyle="solid"
          />
          <Select
            className="darkSelector"
            style={{ width: 200 }}
            value={selectEra}
            //Add options to select previous eras
            //Order: Current Era, Previous Era 1, Previous Era 2, ...
            options={[
              { label: `Current Era ${currentEra.data?.index}`, value: currentEra.data?.index },
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
            placeholder="Search by deployment id"
            prefix={<IoSearch />}
            onChange={(e) => {
              debounceSearch(e.target.value);
            }}
          ></Input>
        </div>
        {statisticGroup === 'projectedRewards' ? (
          <div
            style={{
              padding: 24,
              display: 'flex',
              gap: 16,
              width: 700,
              border: '1px solid var(--dark-mode-border)',
              borderRadius: 8,
              marginBottom: 24,
            }}
          >
            <div className="col-flex" style={{ justifyContent: 'space-between' }}>
              <Typography>Projected Rewards Calculator</Typography>
              <Typography variant="small">
                This provides your estimated rewards based on historic data of the selected Era.
              </Typography>
            </div>

            <div className="col-flex" style={{ gap: 8 }}>
              <Typography>Enter Your Stake</Typography>
              <Input
                className="darkInput"
                style={{ width: 342 }}
                placeholder="Enter your stake"
                type="number"
                suffix={<Typography>{TOKEN}</Typography>}
                value={calcInput}
                onChange={(e) => {
                  if (Number(e.target.value) > 100000000) {
                    setCalcInput(100000000);
                    return;
                  }

                  setCalcInput(Number(e.target.value));
                }}
                onBlur={(e) => {
                  if (Number(e.target.value) < 1) {
                    setCalcInput(1);
                    return;
                  }
                }}
                min="1"
                max={100000000}
              ></Input>
            </div>
          </div>
        ) : (
          ''
        )}

        <Table
          rowKey={(record) => record.deploymentId}
          className={clsx('darkTable', 'hoverRow')}
          loading={loading || currentEra.loading}
          showSorterTooltip={false}
          columns={[
            {
              title: 'Project Deployment',
              dataIndex: 'name',
              key: 'name',
              render: (_: string, record: (typeof renderData)[number]) => {
                return <DeploymentMeta deploymentId={record.deploymentId} projectMetadata={record.projectMetadata} />;
              },
            },
            {
              title: (
                <Tooltip
                  title={
                    'The Total Stake allocated to this project, including the additional stake you entered in the Projected Rewards Calculator.'
                  }
                >
                  Node Operators
                </Tooltip>
              ),
              dataIndex: 'operatorCount',
              key: 'operatorCount',
              render: (text: number) => <Typography>{text}</Typography>,
              sorter: (a: (typeof renderData)[number], b: (typeof renderData)[number]) => {
                return BigNumberJs(a.operatorCount).comparedTo(b.operatorCount);
              },
            },
            {
              title: (
                <Tooltip title="Total Stake allocated to this project across all Node Operators.">
                  {statisticGroup === 'averageRewards' ? 'Stake' : 'Projected Total Stake'}
                </Tooltip>
              ),
              dataIndex: 'allocationAmount',
              key: 'allocationAmount',
              render: (text: string) => (
                <Typography>
                  {text} {TOKEN}
                </Typography>
              ),
              sorter: (a: (typeof renderData)[number], b: (typeof renderData)[number]) => {
                return BigNumberJs(a.rawAllocationAmount).comparedTo(b.rawAllocationAmount);
              },
            },
            {
              title: (
                <Tooltip title="Boost determines the total Stake Rewards to be distributed amongst Node Operators">
                  Boost
                </Tooltip>
              ),
              dataIndex: 'boosterAmount',
              key: 'boosterAmount',
              render: (text: string) => (
                <Typography>
                  {text} {TOKEN}
                </Typography>
              ),
              sorter: (a: (typeof renderData)[number], b: (typeof renderData)[number]) => {
                return BigNumberJs(a.rawBooster).comparedTo(b.rawBooster);
              },
            },
            {
              title: (
                <Tooltip
                  title={
                    'The projected Stake Rewards you would have theoretically earned if you ran the project in the selected Era. This is an approximation and does not suggest the same reward level in future Eras'
                  }
                >
                  Projected Stake Rewards
                </Tooltip>
              ),
              dataIndex: 'allocationRewards',
              key: 'allocationRewards',
              render: (text: string) => (
                <Typography>
                  {text} {TOKEN}
                </Typography>
              ),
              sorter: (a: (typeof renderData)[number], b: (typeof renderData)[number]) => {
                return BigNumberJs(a.rawAllocationRewards).comparedTo(b.rawAllocationRewards);
              },
            },
            {
              title: (
                <Tooltip
                  title="The Average Stake Reward each Node Operator generated. 

                          Stake Rewards are distributed to Node Operators according to their percentage of allocation stake."
                >
                  Average Stake Rewards
                </Tooltip>
              ),
              dataIndex: 'averageAllocationRewards',
              key: 'averageAllocationRewards',
              render: (text: string) => (
                <Typography>
                  {text} {TOKEN}
                </Typography>
              ),
              sorter: (a: (typeof renderData)[number], b: (typeof renderData)[number]) => {
                return BigNumberJs(a.rawAllocationRewards).comparedTo(b.rawAllocationRewards);
              },
            },
            {
              title: (
                <Tooltip
                  title={
                    statisticGroup === 'averageRewards'
                      ? 'The annualised Stake Reward generated for Stake allocated to this project.'
                      : 'The projected Stake APY the project would have achieved if you’d staked in the selected Era. This is an approximation and does not suggest the same Stake APYl in future Eras'
                  }
                >
                  {statisticGroup === 'averageRewards' ? 'Stake Apy' : 'Projected Stake APY'}
                </Tooltip>
              ),
              dataIndex: 'allocationApy',
              key: 'allocationApy',
              render: (text: string) => (
                <Typography>
                  {text} {text === 'N/A' ? '' : '%'}
                </Typography>
              ),
              sorter: (a: (typeof renderData)[number], b: (typeof renderData)[number]) => {
                return BigNumberJs(a.rawAllocationApy).comparedTo(b.rawAllocationApy);
              },
            },
            {
              title: 'Average Queries',
              dataIndex: 'averageQueriesCount',
              key: 'averageQueriesCount',
              render: (text: string) => <Typography>{text}</Typography>,
              sorter: (a: (typeof renderData)[number], b: (typeof renderData)[number]) => {
                return BigNumberJs(a.rawAverageQueriesCount).comparedTo(b.rawAverageQueriesCount);
              },
            },
            {
              title: 'Projected Query Rewards',
              dataIndex: 'averageQueryRewards',
              key: 'queryRewards',
              render: (text: string) => (
                <Typography>
                  {text} {TOKEN}
                </Typography>
              ),
              sorter: (a: (typeof renderData)[number], b: (typeof renderData)[number]) => {
                return BigNumberJs(a.rawAverageQueryRewards).comparedTo(b.rawAverageQueryRewards);
              },
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
              sorter: (a: (typeof renderData)[number], b: (typeof renderData)[number]) => {
                return BigNumberJs(a.rawAverageQueryRewards).comparedTo(b.rawAverageQueryRewards);
              },
            },
            {
              title: 'Projected Rewards',
              dataIndex: 'totalRewards',
              key: 'totalRewards',
              render: (text: string) => (
                <Typography>
                  {text} {TOKEN}
                </Typography>
              ),
              sorter: (a: (typeof renderData)[number], b: (typeof renderData)[number]) => {
                return BigNumberJs(a.rawTotalRewards).comparedTo(b.rawTotalRewards);
              },
            },
            {
              title: (
                <Tooltip title="The average total rewards (Stake Rewards + Query Rewards) generated by Node Operators on this project">
                  Average Rewards
                </Tooltip>
              ),
              dataIndex: 'averageRewards',
              key: 'averageRewards',
              render: (text: string) => (
                <Typography>
                  {text} {TOKEN}
                </Typography>
              ),
              sorter: (a: (typeof renderData)[number], b: (typeof renderData)[number]) => {
                return BigNumberJs(a.rawAverageRewards).comparedTo(b.rawAverageRewards);
              },
            },
          ].filter((i) => {
            const keysOfAver = [
              'name',
              'operatorCount',
              'allocationAmount',
              'boosterAmount',
              'averageAllocationRewards',
              'allocationApy',
              'averageQueriesCount',
              'averageQueryRewards',
              'averageRewards',
            ];
            const keysOfProj = [
              'name',
              'operatorCount',
              'allocationAmount',
              'boosterAmount',
              'allocationRewards',
              'allocationApy',
              'queryRewards',
              'totalRewards',
            ];

            if (statisticGroup === 'averageRewards') {
              return keysOfAver.includes(i.key);
            } else {
              return keysOfProj.includes(i.key);
            }
          })}
          dataSource={renderData}
          pagination={{
            total: allDeployments?.nodes.length,
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
          rowSelection={{
            type: 'radio',
            hideSelectAll: true,
            selectedRowKeys: rowSelected ? [rowSelected.deploymentId] : [],
            onChange: (_, row) => {
              setRowSelected({
                deploymentId: row[0].deploymentId,
              });
            },
          }}
          onRow={(record) => {
            return {
              onClick: () => {
                navigate(
                  `/deployments/${record.deploymentId}?projectMetadata=${record.projectMetadata}&projectId=${record.projectId}`,
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
