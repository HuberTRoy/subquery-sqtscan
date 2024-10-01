import React, { useEffect, useState } from 'react';
import Select from 'antd/es/select';
import { ethers } from 'ethers';
import Highcharts from 'highcharts';

const IndexerRewards = () => {
  const [eras, setEras] = useState<number[]>([]);
  const [eraId, setEraId] = useState<number>(0);
  const [indexers, setIndexers] = useState([]);
  const [indexerId, setIndexerId] = useState('');
  const [chartType, setChartType] = useState('column');
  const [sortColumn, setSortColumn] = useState('y');
  const [sortOrder, setSortOrder] = useState('desc');
  const [topN, setTopN] = useState(40);
  const [loading, setLoading] = useState(false);
  const [chartData, setChartData] = useState([]);
  interface TableData {
    name: string;
    y: number;
    totalStake: number;
    indexerStake: number;
    delegatorStake: number;
    totalReward: number;
    indexerReward: number;
    delegatorReward: number;
    indexerApy: number;
    delegatorApy: number;
  }

  const [tableData, setTableData] = useState<TableData[]>([]);
  const rewardsCache: { [key: number]: any } = {};

  useEffect(() => {
    fetchEras();
  }, []);

  useEffect(() => {
    if (eraId) {
      fetchDataAndRenderChart(eraId, indexerId, topN);
    }
  }, [eraId, indexerId, chartType, sortColumn, sortOrder, topN]);

  const fetchEras = async () => {
    try {
      const response = await fetch('https://api.subquery.network/sq/subquery/subquery-mainnet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, multipart/mixed',
        },
        body: JSON.stringify({
          query: `{
            eras {
              edges {
                node {
                  id
                }
              }
              totalCount
            }
          }`,
        }),
      });
      const result = await response.json();
      const eras: number[] = result.data.eras.edges
        .map((edge: { node: { id: string } }) => parseInt(edge.node.id, 16))
        .sort((a: number, b: number) => b - a);
      setEras(eras);
      setEraId(eras[0]);
    } catch (error) {
      console.error('Failed to fetch eras', error);
    }
  };

  const fetchDataAndRenderChart = async (eraId: number, indexerId: string, topN: number) => {
    setLoading(true);
    if (rewardsCache[eraId]) {
      renderChartAndTable(rewardsCache[eraId], indexerId, eraId, topN);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('https://api.subquery.network/sq/subquery/subquery-mainnet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, multipart/mixed',
        },
        body: JSON.stringify({
          query: `{ indexerRewards(filter: {eraId: {equalTo: "${eraId}"}}) { edges { node { amount eraId indexerId } } nodes { indexer { indexerStakes(filter: {eraIdx: {equalTo: ${eraId}}}) { groupedAggregates(groupBy: INDEXER_ID) { sum { indexerStake delegatorStake totalStake} keys } } indexerApySummaries(filter: {eraIdx: {equalTo: ${eraId}}}) { groupedAggregates(groupBy: INDEXER_ID) { sum { delegatorApy delegatorReward indexerReward indexerApy eraIdx } keys } } } } } }`,
        }),
      });
      const result = await response.json();
      const data = result.data.indexerRewards;
      rewardsCache[eraId] = data;
      renderChartAndTable(data, indexerId, eraId, topN);
    } catch (error) {
      console.error('Failed to fetch data', error);
    } finally {
      setLoading(false);
    }
  };

  interface Era {
    id: string;
  }

  interface IndexerReward {
    amount: string;
    eraId: string;
    indexerId: string;
  }

  interface IndexerStake {
    sum: {
      indexerStake: string;
      delegatorStake: string;
      totalStake: string;
    };
    keys: string[];
  }

  interface IndexerApySummary {
    sum: {
      delegatorApy: string;
      delegatorReward: string;
      indexerReward: string;
      indexerApy: string;
      eraIdx: string;
    };
    keys: string[];
  }

  interface Data {
    indexerRewards: {
      edges: { node: IndexerReward }[];
      nodes: {
        indexer: {
          indexerStakes: { groupedAggregates: IndexerStake[] }[];
          indexerApySummaries: { groupedAggregates: IndexerApySummary[] }[];
        };
      }[];
    };
  }

  interface ChartData {
    name: string;
    y: number;
    totalStake: number;
    indexerStake: number;
    delegatorStake: number;
    totalReward: number;
    indexerReward: number;
    delegatorReward: number;
    indexerApy: number;
    delegatorApy: number;
  }

  const renderChartAndTable = (data: Data, indexerId: string, eraId: number, topN: number) => {
    Highcharts.setOptions(darkTheme);

    Highcharts.chart('container', {
      chart: {
        type: chartType,
      },
      title: {
        text: 'Simple Test Chart',
      },
      xAxis: {
        categories: ['A', 'B', 'C', 'D', 'E'],
      },
      yAxis: {
        title: {
          text: 'Values',
        },
      },
      series: [
        {
          name: 'Test Data',
          data: [1, 3, 2, 4, 5],
        },
        {
          type: 'line', // Specify the type for the second series
          name: 'Line Data',
          data: [2, 2, 3, 5, 4],
        },
      ],
    });
  };

  return (
    <div>
      <div style={{ width: '100%', textAlign: 'left', marginTop: '10px', marginBottom: '10px' }}>
        <a href="IndexerEraDeploymentRewards.html">Go to Indexer Era Deployment Rewards</a>
      </div>
      <div className="row">
        <div className="col-md-6">
          <div>
            {loading && <div className="spinner">Loading...</div>}
            <div className="mb-3 form-group">
              <label htmlFor="indexerCount" className="form-label">
                Show Indexers:
              </label>
              <Select
                id="indexerCount"
                options={[5, 10, 15, 20, 25, 30, 35, 40, 45, 50].map((value) => ({ value, label: value }))}
                defaultValue={{ value: 40, label: 40 }}
                onChange={(option) => setTopN(option.value)}
              />
            </div>
            <div className="mb-3 form-group">
              <label htmlFor="eraSelect" className="form-label">
                Select ERA:
              </label>
              <Select
                id="eraSelect"
                options={eras.map((value) => ({ value, label: value }))}
                value={{ value: eraId, label: eraId }}
                onChange={(option) => setEraId(option.value)}
              />
            </div>
            <div className="mb-3 form-group">
              <label htmlFor="indexerSelect" className="form-label">
                Select Indexer:
              </label>
              <Select
                id="indexerSelect"
                options={indexers.map((value) => ({ value, label: value }))}
                value={{ value: indexerId, label: indexerId }}
                onChange={(option) => setIndexerId(option.value)}
              />
            </div>
          </div>
        </div>
        <div className="col-md-6">
          <div className="mb-3 form-group">
            <label htmlFor="chartTypeSelect" className="form-label">
              Select Chart Type:
            </label>
            <Select
              id="chartTypeSelect"
              options={['column', 'line', 'bar', 'area', 'pie', 'scatter', 'spline'].map((value) => ({
                value,
                label: value,
              }))}
              value={{ value: chartType, label: chartType }}
              onChange={(option) => setChartType(option.value)}
            />
          </div>
          <div className="mb-3 form-group">
            <label htmlFor="sortColumnSelect" className="form-label">
              Sort by:
            </label>
            <Select
              id="sortColumnSelect"
              options={[
                { value: 'name', label: 'Indexer ID' },
                { value: 'y', label: 'Total Current Value' },
                { value: 'totalStake', label: 'Total Stake' },
                { value: 'indexerStake', label: 'Indexer Stake' },
                { value: 'delegatorStake', label: 'Delegator Stake' },
                { value: 'totalReward', label: 'Total Reward' },
                { value: 'indexerReward', label: 'Indexer Reward' },
                { value: 'delegatorReward', label: 'Delegator Reward' },
                { value: 'indexerApy', label: 'Indexer APY (%)' },
                { value: 'delegatorApy', label: 'Delegator APY (%)' },
              ]}
              value={{ value: sortColumn, label: sortColumn }}
              onChange={(option) => setSortColumn(option.value)}
            />
            <Select
              id="sortOrderSelect"
              options={[
                { value: 'desc', label: 'Descending' },
                { value: 'asc', label: 'Ascending' },
              ]}
              value={{ value: sortOrder, label: sortOrder }}
              onChange={(option) => setSortOrder(option.value)}
            />
          </div>
          <button id="fullscreen">Open fullscreen</button>
          <button id="export">Export chart</button>
        </div>
      </div>
      <div id="main-content" className="row">
        <div id="container"></div>
        <div id="data-table">
          <table className="table-sortable">
            <thead>
              <tr>
                <th>Indexer ID</th>
                <th>Amount</th>
                <th>Total Stake</th>
                <th>Indexer Stake</th>
                <th>Delegator Stake</th>
                <th>Total Reward</th>
                <th>Indexer Reward</th>
                <th>Delegator Reward</th>
                <th>Indexer APY (%)</th>
                <th>Delegator APY (%)</th>
              </tr>
            </thead>
            <tbody id="table-body">
              {tableData.map((data, index) => (
                <tr key={index}>
                  <td>{data.name}</td>
                  <td>{data.y}</td>
                  <td>{data.totalStake}</td>
                  <td>{data.indexerStake}</td>
                  <td>{data.delegatorStake}</td>
                  <td>{data.totalReward}</td>
                  <td>{data.indexerReward}</td>
                  <td>{data.delegatorReward}</td>
                  <td>{data.indexerApy}</td>
                  <td>{data.delegatorApy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default IndexerRewards;
