import React, { useEffect, useState } from 'react';
import { gql, useLazyQuery } from '@apollo/client';
import { formatNumber, formatSQT, truncateAddress } from '@utils';
import BigNumberJs from 'bignumber.js';
import Highcharts from 'highcharts';

interface IndexerRewardsProps {
  era: number;
  deploymentId: string;
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

const darkTheme = {
  chart: {
    backgroundColor: '#66000000',
    style: {
      fontFamily: 'sans-serif',
    },
    plotBorderColor: '#606063',
  },
  title: {
    style: {
      color: '#E0E0E3',
      textTransform: 'uppercase',
      fontSize: '20px',
    },
  },
  xAxis: {
    gridLineColor: '#707073',
    labels: {
      style: {
        color: '#E0E0E3',
      },
    },
    lineColor: '#707073',
    minorGridLineColor: '#505053',
    tickColor: '#707073',
    title: {
      style: {
        color: '#A0A0A3',
      },
    },
  },
  yAxis: {
    gridLineColor: '#707073',
    labels: {
      style: {
        color: '#E0E0E3',
      },
    },
    lineColor: '#707073',
    minorGridLineColor: '#505053',
    tickColor: '#707073',
    tickWidth: 1,
    title: {
      style: {
        color: '#A0A0A3',
      },
    },
  },
  tooltip: {
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    style: {
      color: '#F0F0F0',
    },
  },
  plotOptions: {
    series: {
      dataLabels: {
        color: '#B0B0B3',
      },
      marker: {
        lineColor: '#333',
      },
    },
    boxplot: {
      fillColor: '#505053',
    },
    candlestick: {
      lineColor: 'white',
    },
    errorbar: {
      color: 'white',
    },
  },
  legend: {
    itemStyle: {
      color: '#E0E0E3',
    },
    itemHoverStyle: {
      color: '#FFF',
    },
    itemHiddenStyle: {
      color: '#606063',
    },
  },
  credits: {
    style: {
      color: '#666',
    },
  },
  labels: {
    style: {
      color: '#707073',
    },
  },
  drilldown: {
    activeAxisLabelStyle: {
      color: '#F0F0F3',
    },
    activeDataLabelStyle: {
      color: '#F0F0F3',
    },
  },
  navigation: {
    buttonOptions: {
      symbolStroke: '#DDDDDD',
      theme: {
        fill: '#505053',
      },
    },
  },
  rangeSelector: {
    buttonTheme: {
      fill: '#505053',
      stroke: '#000000',
      style: {
        color: '#CCC',
      },
      states: {
        hover: {
          fill: '#707073',
          stroke: '#000000',
          style: {
            color: 'white',
          },
        },
        select: {
          fill: '#000003',
          stroke: '#000000',
          style: {
            color: 'white',
          },
        },
      },
    },
    inputBoxBorderColor: '#505053',
    inputStyle: {
      backgroundColor: '#333',
      color: 'silver',
    },
    labelStyle: {
      color: 'silver',
    },
  },
  navigator: {
    handles: {
      backgroundColor: '#666',
      borderColor: '#AAA',
    },
    outlineColor: '#CCC',
    maskFill: 'rgba(255,255,255,0.1)',
    series: {
      color: '#7798BF',
      lineColor: '#A6C7ED',
    },
    xAxis: {
      gridLineColor: '#505053',
    },
  },
  scrollbar: {
    barBackgroundColor: '#808083',
    barBorderColor: '#808083',
    buttonArrowColor: '#CCC',
    buttonBackgroundColor: '#606063',
    buttonBorderColor: '#606063',
    rifleColor: '#FFF',
    trackBackgroundColor: '#404043',
    trackBorderColor: '#404043',
  },
};

const FETCH_REWARDS_QUERY = gql`
  query MyQuery($eraId: BigFloat!, $eraIdx: Int) {
    indexerRewards(filter: { eraId: { equalTo: $eraId } }) {
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
          indexerApySummaries(filter: { eraIdx: { equalTo: $eraIdx } }) {
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

const IndexerRewards: React.FC<IndexerRewardsProps> = ({ era, deploymentId }) => {
  const [eraId, setEraId] = useState<number>(era);
  const [indexerId, setIndexerId] = useState(deploymentId);
  const [chartType, setChartType] = useState('column');
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

  // Lắng nghe sự thay đổi của era và deploymentId
  useEffect(() => {
    setEraId(era);
    setIndexerId(deploymentId);
  }, [era, deploymentId]);

  useEffect(() => {
    fetchRewards({ variables: { eraId, eraIdx: era } });
  }, [eraId, fetchRewards]);

  useEffect(() => {
    if (rewardsData) {
      console.log('RewardsData' + rewardsData);
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
      console.log(chartData);
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

        console.log('groupedAggregatesStakes: ' + JSON.stringify(groupedAggregatesStakes));
        console.log('groupedAggregatesApy: ' + JSON.stringify(groupedAggregatesApy));

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

        if (!hasValidGroupedAggregatesStakes) {
          console.log(`Invalid groupedAggregatesStakes for indexerId: ${reward.indexerId}`);
        }
        if (!hasValidGroupedAggregatesApy) {
          console.log(`Invalid groupedAggregatesApy for indexerId: ${reward.indexerId}`);
        }

        return hasValidGroupedAggregatesStakes || hasValidGroupedAggregatesApy;
      });

      console.log('indexerDetail: ' + JSON.stringify(indexerDetail));
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

    console.log('dataSource: ' + JSON.stringify(dataSource));

    return dataSource;
  }

  const renderChart = (data: ChartData[]): void => {
    Highcharts.setOptions(darkTheme);

    Highcharts.chart('container', {
      chart: {
        type: chartType,
        height: 600, // Đặt chiều cao của biểu đồ thành 600px
      },
      title: {
        text: 'Node Operator and Delegator APY Era ' + eraId,
      },
      xAxis: {
        categories: data.map((d) => d.name),
      },
      yAxis: [
        {
          title: {
            text: 'SQT',
          },
        },
        {
          title: {
            text: 'APY',
          },
          opposite: true,
        },
      ],
      credits: {
        enabled: false,
      },
      series: [
        {
          name: 'Total Stake',
          data: data.map((d) => d.totalStake),
        },
        {
          name: 'Indexer Stake',
          data: data.map((d) => d.indexerStake),
        },
        {
          name: 'Delegator Stake',
          data: data.map((d) => d.delegatorStake),
        },
        {
          name: 'Total Reward',
          data: data.map((d) => d.totalReward),
        },
        {
          name: 'Indexer Reward',
          data: data.map((d) => d.indexerReward),
        },
        {
          name: 'Delegator Reward',
          data: data.map((d) => d.delegatorReward),
        },
        {
          name: 'Indexer APY',
          data: data.map((d) => d.indexerApy),
          yAxis: 1,
          type: 'line',
        },
        {
          name: 'Delegator APY',
          data: data.map((d) => d.delegatorApy),
          yAxis: 1,
          type: 'line',
        },
      ],
    });
  };

  return (
    <div>
      <div id="main-content" className="row">
        <div id="container"></div>
      </div>
    </div>
  );
};

export default IndexerRewards;
