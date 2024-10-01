import React, { useEffect, useState } from 'react';
import { gql, useLazyQuery } from '@apollo/client';
import { formatNumber, formatSQT } from '@utils';
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
  query MyQuery($eraId: BigFloat!, $era: String, $eraIdx: Int) {
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
          indexerStakes(filter: { eraId: { equalTo: $era } }) {
            groupedAggregates(groupBy: INDEXER_ID) {
              sum {
                indexerStake
                delegatorStake
                totalStake
              }
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
          amount: string;
          eraId: string;
          indexerId: string;
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
    fetchRewards({ variables: { eraId, era: era.toString(), eraIdx: era } });
  }, [eraId, fetchRewards]);

  useEffect(() => {
    if (rewardsData) {
      const transformedData = transformRewardsData(rewardsData);
      const chartData: ChartData[] = transformedData.map((data) => ({
        name: data.indexerId,
        totalStake: Number(data.totalStake),
        indexerStake: Number(data.indexerStake),
        delegatorStake: Number(data.delegatorStake),
        totalReward: Number(data.amount),
        indexerReward: Number(data.indexerReward),
        delegatorReward: Number(data.delegatorReward),
        indexerApy: Number(data.indexerApy),
        delegatorApy: Number(data.delegatorApy),
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

    const transformedData: TransformedReward[] = [];

    rewardsData.indexerRewards.edges.forEach((edge) => {
      const { amount, eraId, indexerId } = edge.node;
      const transformedReward: TransformedReward = {
        indexerId,
        eraId,
        amount: formatNumber(formatSQT(new BigNumberJs(amount).toString())).toString(),
      };

      const indexerNode = rewardsData.indexerRewards.nodes.find((node) =>
        node.indexer.indexerStakes.groupedAggregates.some((agg) => agg.keys.includes(indexerId)),
      );

      if (indexerNode) {
        const indexerStakeAggregate = indexerNode.indexer.indexerStakes.groupedAggregates.find((agg) =>
          agg.keys.includes(indexerId),
        );
        const indexerApyAggregate = indexerNode.indexer.indexerApySummaries.groupedAggregates.find((agg) =>
          agg.keys.includes(indexerId),
        );

        if (indexerStakeAggregate) {
          transformedReward.indexerStake = formatNumber(
            formatSQT(new BigNumberJs(indexerStakeAggregate.sum.indexerStake).toString()),
          ).toString();
          transformedReward.delegatorStake = formatNumber(
            formatSQT(new BigNumberJs(indexerStakeAggregate.sum.delegatorStake).toString()),
          ).toString();
          transformedReward.totalStake = formatNumber(
            formatSQT(new BigNumberJs(indexerStakeAggregate.sum.totalStake).toString()),
          ).toString();
        }

        if (indexerApyAggregate) {
          transformedReward.delegatorApy = formatNumber(
            formatSQT(new BigNumberJs(indexerApyAggregate.sum.delegatorApy).toString()),
          ).toString();
          transformedReward.delegatorReward = formatNumber(
            formatSQT(new BigNumberJs(indexerApyAggregate.sum.delegatorReward).toString()),
          ).toString();
          transformedReward.indexerReward = formatNumber(
            formatSQT(new BigNumberJs(indexerApyAggregate.sum.indexerReward).toString()),
          ).toString();
          transformedReward.indexerApy = formatNumber(
            formatSQT(new BigNumberJs(indexerApyAggregate.sum.indexerApy).toString()),
          ).toString();
          transformedReward.eraIdx = indexerApyAggregate.sum.eraIdx; // eraIdx có thể không cần định dạng
        }
      }

      transformedData.push(transformedReward);
    });

    return transformedData;
  }

  const renderChart = (data: ChartData[]): void => {
    Highcharts.setOptions(darkTheme);

    Highcharts.chart('container', {
      chart: {
        type: chartType,
      },
      title: {
        text: 'Indexer Rewards Chart',
      },
      xAxis: {
        categories: data.map((d) => d.name),
      },
      yAxis: {
        title: {
          text: 'Values',
        },
      },
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
        },
        {
          name: 'Delegator APY',
          data: data.map((d) => d.delegatorApy),
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
