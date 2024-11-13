import { CSSProperties, useEffect, useMemo, useState } from 'react';
import { gql, useLazyQuery } from '@apollo/client';
import LineCharts, { FilterType, xAxisScalesFunc } from '@components/LineCharts';
import { Era, useEra } from '@hooks/useEra';
import { Typography } from '@subql/components';
import { formatNumber, formatSQT, numToHex, parseError, renderAsync, TOKEN, toPercentage } from '@utils';
import { Skeleton } from 'antd';
import BigNumberJs from 'bignumber.js';
import dayjs from 'dayjs';

export const getSplitDataByEra = (currentEra: Era, includeNextEra = false) => {
  const period = currentEra.period;
  const splitData = 86400;

  const plusedEra = period > splitData ? 1 : Math.floor(splitData / period);
  // TODO:
  //   There have some problems in here
  //   1. secondFromLastTimes / period is just a fuzzy result. also we can get the exactly result by Graphql.
  //   2. based on 1. also need to calcuate the xAxisScale in props.
  //   3. based on 1. and 2. also need to do a lots of things for compatite dev env(1 era < 1 day).
  const getIncludesEras = (lastTimes: dayjs.Dayjs) => {
    const today = dayjs();
    const secondsFromLastTimes = (+today - +lastTimes) / 1000;

    const eras = Math.ceil(secondsFromLastTimes / period) + (includeNextEra ? plusedEra : 0);

    const currentEraIndex = includeNextEra ? currentEra.index + plusedEra : currentEra.index;
    const includesEras = new Array(eras)
      .fill(0)
      .map((_, index) => currentEraIndex - index)
      .filter((i) => i > 0);
    return {
      includesErasHex: includesEras.map(numToHex),
      includesEras,
      allErasHex: new Array(currentEraIndex).fill(0).map((_, index) => numToHex(index + 1)),
    };
  };

  const fillData = (
    rawData: readonly {
      readonly keys: readonly string[] | null;
      readonly sum: { readonly amount: string | bigint } | null;
    }[],
    includesErasHex: string[],
    paddingLength: number,

    options?: {
      fillDevDataByGetMax: boolean;
    },
  ) => {
    if (rawData.some((i) => !i.keys || !i.sum)) {
      return [];
    }

    const amounts = rawData.map((i) => {
      return {
        key: (i.keys as string[])[0],
        amount: formatSQT((i.sum as { amount: string | bigint }).amount) as number,
      };
    });

    // fill the data that cannot gatherd by Graphql. e.g: includesEras wants to get the data of 0x0c and 0x0d
    // but Graphql just return the data of 0x0c
    // in this situation, the amount and nextAmount of 0x0d is 0x0c's nextAmount
    includesErasHex
      .sort((a, b) => parseInt(a, 16) - parseInt(b, 16))
      .forEach((key) => {
        if (!amounts.find((i) => i.key === key)) {
          amounts.push({ key: key, amount: 0 });
        }
      });

    // Graphql sort is incorrect, because it is a string.
    let renderAmounts = amounts.sort((a, b) => parseInt(a.key, 16) - parseInt(b.key, 16)).map((i) => i.amount);
    // but in dev env will less than one day.
    if (period < splitData) {
      const eraCountOneDay = splitData / period;
      renderAmounts = renderAmounts.reduce(
        (acc: { result: number[]; curResult: number }, cur, index) => {
          if (options?.fillDevDataByGetMax) {
            acc.curResult = Math.max(cur, acc.curResult);
          } else {
            acc.curResult += cur;
          }
          if ((index + 1) % eraCountOneDay === 0 || index === renderAmounts.length - 1) {
            acc.result.push(acc.curResult);
            acc.curResult = 0;
          }

          return acc;
        },
        { result: [], curResult: 0 },
      ).result;
    }

    if (paddingLength > renderAmounts.length) {
      new Array(paddingLength - renderAmounts.length).fill(0).forEach((_) => renderAmounts.unshift(0));
    }

    return renderAmounts;
  };

  return { getIncludesEras, fillData };
};

export const RewardsByType = (props: {
  title?: string;
  dataDimensionsName?: string[];
  chartsStyle?: CSSProperties;
  skeletonHeight?: number;
  deploymentId?: string;
  indexerAddress?: string;
}) => {
  const {
    title = 'Rewards by Type',
    dataDimensionsName = ['Stake Rewards', 'Query Rewards'],
    chartsStyle,
    skeletonHeight,
    deploymentId,
    indexerAddress,
  } = props;
  const { currentEra } = useEra();
  const [filter, setFilter] = useState<FilterType>({ date: 'lm' });
  const [renderRewards, setRenderRewards] = useState<number[][]>([[]]);
  const [rawRewardsData, setRawRewardsData] = useState<{ allocation: number[]; query: number[]; total: number[] }>({
    allocation: [],
    query: [],
    total: [],
  });

  const rewardsLineXScales = useMemo(() => {
    const getXScales = (period: number, filterVal: FilterType) => {
      const getDefaultScales = xAxisScalesFunc(period, currentEra.data?.estEndTime);

      const result = getDefaultScales[filterVal.date]();
      return result.slice(0, result.length - 1);
    };
    const slicedResult = getXScales(currentEra.data?.period || 0, filter);
    return {
      val: {
        renderData: slicedResult.map((i) => i.format('MMM D')),
        rawData: slicedResult,
      },
      getXScales,
    };
  }, [filter.date, currentEra]);

  const [fetchRewards, rewardsData] = useLazyQuery<{
    eraDeploymentRewards: {
      groupedAggregates: { keys: string[]; sum: { allocationRewards: string; totalRewards: string } }[];
    };
    indexerEraDeploymentRewards: {
      groupedAggregates: { keys: string[]; sum: { allocationRewards: string; totalRewards: string } }[];
    };
  }>(gql`
    query fetchRewards($deploymentId: String! = "0", $eraIds: [Int!]!, $indexer: String! = "") {
      eraDeploymentRewards(filter: { deploymentId: { equalTo: $deploymentId }, eraIdx: { in: $eraIds } }) {
        groupedAggregates(groupBy: ERA_IDX) {
          keys
          sum {
            allocationRewards
            totalRewards
          }
        }
      }

      indexerEraDeploymentRewards(filter: { indexerId: { equalTo: $indexer }, eraIdx: { in: $eraIds } }) {
        groupedAggregates(groupBy: ERA_IDX) {
          keys
          sum {
            allocationRewards
            totalRewards
          }
        }
      }
    }
  `);

  const fetchRewardsByEra = async (filterVal: FilterType | undefined = filter) => {
    if (!currentEra.data) return;
    if (!filterVal) return;
    const { getIncludesEras, fillData } = getSplitDataByEra(currentEra.data);
    const { includesEras, includesErasHex } = {
      lm: () => getIncludesEras(dayjs().subtract(31, 'day')),
      l3m: () => getIncludesEras(dayjs().subtract(90, 'day')),
      ly: () => getIncludesEras(dayjs().subtract(365, 'day')),
    }[filterVal.date]();
    const apis = fetchRewards;
    const vars = {
      eraIds: includesEras,
      deploymentId: deploymentId,
      indexer: indexerAddress,
    };
    const res = await apis({
      variables: vars,
      fetchPolicy: 'no-cache',
    });

    const maxPaddingLength = rewardsLineXScales.getXScales(currentEra.data.period, filterVal).length;

    // // rewards don't want to show lastest era data
    const removedLastEras = includesErasHex.slice(1, includesErasHex.length);
    const curry = <T extends Parameters<typeof fillData>['0']>(data: T) =>
      fillData(data, removedLastEras, maxPaddingLength);

    const dataSource = indexerAddress ? res?.data?.indexerEraDeploymentRewards : res?.data?.eraDeploymentRewards;

    const allocationRewards = curry(
      dataSource?.groupedAggregates?.map((i) => {
        return {
          keys: i.keys.map((i) => numToHex(+i)),

          sum: {
            amount: i.sum.allocationRewards,
          },
        };
      }) || [],
    );

    const queryRewards = curry(
      dataSource?.groupedAggregates?.map((i) => {
        return {
          keys: i.keys.map((i) => numToHex(+i)),

          sum: {
            amount: BigNumberJs(i.sum.totalRewards).minus(i.sum.allocationRewards).toString(),
          },
        };
      }) || [],
    );

    const totalRewards = curry(
      dataSource?.groupedAggregates?.map((i) => {
        return {
          keys: i.keys.map((i) => numToHex(+i)),
          sum: {
            amount: i.sum.totalRewards,
          },
        };
      }) || [],
    );
    setRawRewardsData({
      allocation: allocationRewards,
      query: queryRewards,
      total: totalRewards,
    });

    setRenderRewards([allocationRewards, queryRewards]);
  };

  useEffect(() => {
    fetchRewardsByEra();
  }, [currentEra.data?.index, deploymentId]);

  return renderAsync(
    {
      ...rewardsData,
      loading: rewardsData.previousData ? false : rewardsData.loading,
      data: rewardsData.data || rewardsData.previousData,
    },
    {
      loading: () => (
        <Skeleton
          className="darkSkeleton"
          active
          paragraph={{ rows: 8 }}
          style={{ height: skeletonHeight ? skeletonHeight : 'auto' }}
        ></Skeleton>
      ),
      error: (e) => <Typography>{parseError(e)}</Typography>,
      data: () => {
        return (
          <LineCharts
            theme="dark"
            value={filter}
            onChange={(val) => {
              setFilter(val);
              fetchRewardsByEra(val);
            }}
            style={chartsStyle}
            xAxisScales={rewardsLineXScales.val}
            title={title}
            dataDimensionsName={dataDimensionsName}
            chartData={renderRewards}
            onTriggerTooltip={(index, curDate) => {
              return `<div class="col-flex" style="width: 280px; font-size: 12px;">
              <span>${curDate.format('MMM D, YYYY')}</span>
              <div class="flex-between" style="margin-top: 8px;">
                <span>Total</span>
                <span>${formatNumber(rawRewardsData.total[index])} ${TOKEN}</span>
              </div>
              <div class="flex-between" style="margin: 8px 0;">
                <span>${dataDimensionsName[0]}</span>
                <span>${formatNumber(rawRewardsData.allocation[index])} ${TOKEN} (${toPercentage(
                  rawRewardsData.allocation[index],
                  rawRewardsData.total[index],
                )})</span>
              </div>
              <div class="flex-between">
              <span>${dataDimensionsName[1]}</span>
              <span>${formatNumber(rawRewardsData.query[index])} ${TOKEN} (${toPercentage(
                rawRewardsData.query[index],
                rawRewardsData.total[index],
              )})</span>
            </div>
            </div>`;
            }}
            customColors={['#4388DD', '#65CD45']}
          ></LineCharts>
        );
      },
    },
  );
};
