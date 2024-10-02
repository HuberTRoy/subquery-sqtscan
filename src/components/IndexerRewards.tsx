import React, { useEffect, useState } from 'react';
import { gql, useLazyQuery } from '@apollo/client';
import { formatNumber, truncateAddress } from '@utils';
import * as echarts from 'echarts';

interface IndexerRewardsProps {
  era: number;
  indexerId: string;
}

interface ChartData {
  name: string;
  totalStake: number;
  indexerStake: number;
  delegatorStake: number;
  totalReward: number;
  indexerReward: number;
  delegatorReward: number;
  indexerApy: number;
  delegatorApy: number;
}

const FETCH_REWARDS_QUERY = gql`
  query MyQuery($eraId: BigFloat!, $eraIdx: Int, $indexerId: String) {
    indexerRewards(filter: { eraId: { equalTo: $eraId }, indexerId: { includes: $indexerId } }) {
      edges {
        node {
          amount
          eraId
          indexerId
        }
      }
      nodes {
        indexer {
          indexerStakes(filter: { eraIdx: { equalTo: $eraIdx } }) {
            groupedAggregates(groupBy: INDEXER_ID) {
              sum {
                indexerStake
                delegatorStake
                totalStake
              }
              keys
            }
          }
          indexerApySummaries(filter: { eraIdx: { equalTo: $eraIdx }, indexerId: { includes: $indexerId } }) {
            groupedAggregates(groupBy: INDEXER_ID) {
              sum {
                delegatorApy
                delegatorReward
                indexerReward
                indexerApy
                eraIdx
              }
              keys
            }
          }
        }
      }
    }
  }
`;

const IndexerRewards: React.FC<IndexerRewardsProps> = ({ era, indexerId }) => {
  const [eraId, setEraId] = useState<number>(era);
  const [currentIndexerId, setIndexerId] = useState(indexerId);
  const [chartData, setChartData] = useState<ChartData[]>([]);

  interface IndexerRewardsData {
    indexerRewards: {
      edges: {
        node: {
          indexerId: string;
          eraId: string;
          amount: string;
        };
      }[];
      nodes: {
        indexer: {
          indexerStakes: {
            groupedAggregates: {
              sum: {
                indexerStake: string;
                delegatorStake: string;
                totalStake: string;
              };
              keys: string[];
            }[];
          };
          indexerApySummaries: {
            groupedAggregates: {
              sum: {
                delegatorApy: string;
                delegatorReward: string;
                indexerReward: string;
                indexerApy: string;
                eraIdx: string;
              };
              keys: string[];
            }[];
          };
        };
      }[];
    };
  }

  const [fetchRewards, { data: rewardsData }] = useLazyQuery<IndexerRewardsData>(FETCH_REWARDS_QUERY);

  useEffect(() => {
    setEraId(era);
    setIndexerId(indexerId);
  }, [era, indexerId]);

  useEffect(() => {
    fetchRewards({ variables: { eraId: eraId, eraIdx: era, indexerId: currentIndexerId } });
  }, [eraId, currentIndexerId, fetchRewards]);

  useEffect(() => {
    if (rewardsData) {
      const transformedData = transformRewardsData(rewardsData);
      const chartData: ChartData[] = transformedData.map((data) => ({
        name: truncateAddress(data.indexerId),
        totalStake: parseFloat(data.totalStake ?? '0') / Math.pow(10, 18),
        indexerStake: parseFloat(data.indexerStake ?? '0') / Math.pow(10, 18),
        delegatorStake: parseFloat(data.delegatorStake ?? '0') / Math.pow(10, 18),
        totalReward: parseFloat(data.amount ?? '0') / Math.pow(10, 18),
        indexerReward: parseFloat(data.indexerReward ?? '0') / Math.pow(10, 18),
        delegatorReward: parseFloat(data.delegatorReward ?? '0') / Math.pow(10, 18),
        indexerApy: parseFloat(data.indexerApy ?? '0') / Math.pow(10, 16),
        delegatorApy: parseFloat(data.delegatorApy ?? '0') / Math.pow(10, 16),
      }));
      setChartData(chartData);
      renderChart(chartData);
    }
  }, [rewardsData]);

  interface TransformedReward {
    indexerId: string;
    eraId: string;
    amount: string;
    indexerStake?: string;
    delegatorStake?: string;
    totalStake?: string;
    delegatorApy?: string;
    delegatorReward?: string;
    indexerReward?: string;
    indexerApy?: string;
    eraIdx?: string;
  }

  function transformRewardsData(rewardsData: IndexerRewardsData | undefined): TransformedReward[] {
    if (!rewardsData) {
      return [];
    }

    const data = rewardsData.indexerRewards;
    let rewards = data.edges.map((edge) => edge.node);
    let indexerDetails = data.nodes.map((node) => node.indexer);

    let dataSource = rewards.map((reward) => {
      const indexerDetail = indexerDetails.find((indexer) => {
        const groupedAggregatesStakes = indexer.indexerStakes.groupedAggregates;
        const groupedAggregatesApy = indexer.indexerApySummaries.groupedAggregates;
        const hasValidGroupedAggregatesStakes =
          groupedAggregatesStakes &&
          groupedAggregatesStakes.length > 0 &&
          groupedAggregatesStakes[0].keys &&
          groupedAggregatesStakes[0].keys.includes(reward.indexerId);
        const hasValidGroupedAggregatesApy =
          groupedAggregatesApy &&
          groupedAggregatesApy.length > 0 &&
          groupedAggregatesApy[0].keys &&
          groupedAggregatesApy[0].keys.includes(reward.indexerId);
        return hasValidGroupedAggregatesStakes || hasValidGroupedAggregatesApy;
      });
      const indexerStake = indexerDetail?.indexerStakes?.groupedAggregates[0]?.sum?.indexerStake || '0';
      const delegatorStake = indexerDetail?.indexerStakes?.groupedAggregates[0]?.sum?.delegatorStake || '0';
      const totalStake = indexerDetail?.indexerStakes?.groupedAggregates[0]?.sum?.totalStake || '0';

      const indexerAggregate =
        indexerDetail?.indexerApySummaries?.groupedAggregates.find(
          (aggregate) => aggregate.keys.includes(reward.indexerId) && aggregate.sum.eraIdx === reward.eraId,
        ) || {};

      const indexerReward = (indexerAggregate as any)?.sum?.indexerReward || '0';
      const delegatorReward = (indexerAggregate as any)?.sum?.delegatorReward || '0';
      const totalReward = Number(indexerReward) + Number(delegatorReward);
      const indexerApy = (indexerAggregate as any)?.sum?.indexerApy || '0';
      const delegatorApy = (indexerAggregate as any)?.sum?.delegatorApy || '0';

      return {
        indexerId: reward.indexerId,
        eraId: reward.eraId,
        amount: reward.amount,
        name: reward.indexerId,
        y: parseFloat(reward.amount) / Math.pow(10, 18),
        totalStake: totalStake,
        indexerStake: indexerStake,
        delegatorStake: delegatorStake,
        indexerReward: indexerReward,
        delegatorReward: delegatorReward,
        totalReward: totalReward,
        indexerApy: indexerApy,
        delegatorApy: delegatorApy,
      };
    });
    return dataSource;
  }

  const renderChart = (data: ChartData[]): void => {
    const chartDom = document.getElementById('container');
    if (chartDom) {
      const myChart = echarts.init(chartDom);
      const option = {
        title: {
          text: '',
          textStyle: {
            color: '#E0E0E3',
          },
        },
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          textStyle: {
            color: '#F0F0F0',
          },
          axisPointer: {
            type: 'shadow',
          },
          formatter: function (params: any[]) {
            const indexerId = params[0].axisValue; // Lấy giá trị của trục X
            let tooltipContent = `Indexer: ${indexerId}<br/>`; // Thêm dòng "Indexer" với giá trị indexerId trên đầu
            params.forEach((param) => {
              const value = param.seriesName.includes('APY')
                ? `${formatNumber(param.value)}%`
                : formatNumber(param.value);
              tooltipContent += `${param.marker} ${param.seriesName}: ${value}<br/>`;
            });
            return tooltipContent;
          },
        },
        legend: {
          textStyle: {
            color: '#E0E0E3',
          },
        },
        xAxis: {
          type: 'category',
          data: data.map((d) => d.name),
          axisLine: {
            lineStyle: {
              color: '#707073',
            },
          },
          axisLabel: {
            color: '#E0E0E3',
            rotate: 45, // Xoay nhãn trục X 45 độ
          },
        },
        yAxis: [
          {
            type: 'value',
            name: 'SQT',
            axisLine: {
              lineStyle: {
                color: '#707073',
              },
            },
            axisLabel: {
              color: '#E0E0E3',
            },
          },
          {
            type: 'value',
            name: 'APY',
            axisLine: {
              lineStyle: {
                color: '#707073',
              },
            },
            axisLabel: {
              color: '#E0E0E3',
            },
            splitLine: {
              show: false,
            },
          },
        ],
        series: [
          {
            name: 'Total Stake',
            type: 'bar',
            data: data.map((d) => d.totalStake),
          },
          {
            name: 'Indexer Stake',
            type: 'bar',
            data: data.map((d) => d.indexerStake),
          },
          {
            name: 'Delegator Stake',
            type: 'bar',
            data: data.map((d) => d.delegatorStake),
          },
          {
            name: 'Total Reward',
            type: 'bar',
            data: data.map((d) => d.totalReward),
          },
          {
            name: 'Indexer Reward',
            type: 'bar',
            data: data.map((d) => d.indexerReward),
          },
          {
            name: 'Delegator Reward',
            type: 'bar',
            data: data.map((d) => d.delegatorReward),
          },
          {
            name: 'Indexer APY',
            type: 'line',
            yAxisIndex: 1,
            data: data.map((d) => d.indexerApy),
          },
          {
            name: 'Delegator APY',
            type: 'line',
            yAxisIndex: 1,
            data: data.map((d) => d.delegatorApy),
          },
        ],
        backgroundColor: '#66000000',
      };
      myChart.setOption(option);
    }
  };

  return (
    <div>
      <div id="main-content" className="row">
        <div id="container" style={{ width: '100%', height: '600px' }}></div>
      </div>
    </div>
  );
};

export default IndexerRewards;
