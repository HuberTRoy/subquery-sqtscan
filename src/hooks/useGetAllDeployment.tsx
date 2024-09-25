import { useMemo } from 'react';
import { gql, useLazyQuery } from '@apollo/client';

import { useAsyncMemo } from './useAsyncMemo';
import { useEra } from './useEra';

export const useGetAllDeployment = (props: { selectEra: number }) => {
  const { currentEra } = useEra();

  const { selectEra } = props;

  const blockHeightOfQuery = useMemo(() => {
    if (!currentEra.data?.index) return '99999999999999999';

    if (selectEra === currentEra.data.index - 1 || selectEra === currentEra.data.index) {
      return '99999999999999999';
    }

    return currentEra.data.eras?.find((i) => parseInt(i.id, 16) === selectEra)?.createdBlock || '99999999999999999';
  }, [selectEra, currentEra.data?.index]);

  const [fetchAllDeployments] = useLazyQuery<{
    eraDeploymentRewards: {
      nodes: { deploymentId: string; totalRewards: string }[];
      totalCount: number;
    };
  }>(gql`
    query allDeployments($currentIdx: Int!, $first: Int! = 30, $offset: Int! = 0) {
      eraDeploymentRewards(
        orderBy: TOTAL_REWARDS_DESC
        filter: { eraIdx: { equalTo: $currentIdx } }
        first: $first
        offset: $offset
      ) {
        nodes {
          deploymentId
          totalRewards
        }
        totalCount
      }
    }
  `);

  const [fetchAllDeploymentsInfomations] = useLazyQuery<{
    deployments: {
      nodes: {
        id: string;
        metadata: string;
        project: {
          id: string;
          metadata: string;
        };
        indexers: {
          totalCount: number;
        };
      }[];
    };
    indexerAllocationSummaries: {
      groupedAggregates: { keys: string[]; sum: { totalAmount: string } }[];
    };
    deploymentBoosterSummaries: {
      groupedAggregates: { keys: string[]; sum: { totalAmount: string } }[];
    };
    eraDeploymentRewards: {
      groupedAggregates: { keys: string[]; sum: { allocationRewards: string; totalRewards: string } }[];
    };
  }>(gql`
    query allDeploymentsInfomations($blockHeight: String!, $deploymentIds: [String!], $currentIdx: Int!) {
      deployments(blockHeight: $blockHeight, filter: { id: { in: $deploymentIds } }) {
        nodes {
          id
          metadata
          project {
            id
            metadata
          }
          indexers(filter: { indexer: { active: { equalTo: true } }, status: { notEqualTo: TERMINATED } }) {
            totalCount
          }
        }
      }

      indexerAllocationSummaries(blockHeight: $blockHeight, filter: { deploymentId: { in: $deploymentIds } }) {
        groupedAggregates(groupBy: DEPLOYMENT_ID) {
          keys
          sum {
            totalAmount
          }
        }
      }

      deploymentBoosterSummaries(blockHeight: $blockHeight, filter: { deploymentId: { in: $deploymentIds } }) {
        groupedAggregates(groupBy: DEPLOYMENT_ID) {
          keys
          sum {
            totalAmount
          }
        }
      }

      eraDeploymentRewards(filter: { deploymentId: { in: $deploymentIds }, eraIdx: { equalTo: $currentIdx } }) {
        groupedAggregates(groupBy: DEPLOYMENT_ID) {
          keys
          sum {
            allocationRewards
            totalRewards
          }
        }
      }
    }
  `);

  const allDeployments = useAsyncMemo(async () => {
    if (!selectEra) return { nodes: [], totalCount: 0 };
    let currentOffset = 0;
    const res = await fetchAllDeployments({
      variables: {
        currentIdx: selectEra,
        first: 100,
        offset: 0,
      },
    });

    const result = res.data?.eraDeploymentRewards || { nodes: [], totalCount: 0 };
    const resultTotal = res.data?.eraDeploymentRewards.totalCount || 0;
    while (currentOffset < resultTotal) {
      currentOffset += 100;
      const res = await fetchAllDeployments({
        variables: {
          currentIdx: selectEra,
          first: 100,
          offset: currentOffset,
        },
      });

      result.nodes = result.nodes.concat(res.data?.eraDeploymentRewards.nodes || []);
    }

    return result;
  }, [selectEra]);

  const allDeploymentsInfomations = useAsyncMemo(async () => {
    if (!allDeployments.data?.nodes.length)
      return {
        deployments: { nodes: [] },
        indexerAllocationSummaries: { groupedAggregates: [] },
        deploymentBoosterSummaries: { groupedAggregates: [] },
        eraDeploymentRewards: { groupedAggregates: [] },
      };
    const deploymentIds = allDeployments.data?.nodes.map((node) => node.deploymentId);

    const chunkedDeploymentIds: string[][] = [];
    for (let i = 0; i < deploymentIds.length; i += 100) {
      chunkedDeploymentIds.push(deploymentIds.slice(i, i + 100));
    }

    const results = await Promise.all(
      chunkedDeploymentIds.map((chunk) =>
        fetchAllDeploymentsInfomations({
          variables: {
            deploymentIds: chunk,
            currentIdx: selectEra,
            blockHeight: blockHeightOfQuery.toString(),
          },
        }),
      ),
    );

    // Combine results from all chunks
    return results.reduce(
      (
        acc: {
          deployments: { nodes: any[] };
          indexerAllocationSummaries: { groupedAggregates: any[] };
          deploymentBoosterSummaries: { groupedAggregates: any[] };
          eraDeploymentRewards: { groupedAggregates: any[] };
        },
        result,
      ) => {
        if (result.data) {
          acc.deploymentBoosterSummaries.groupedAggregates = [
            ...acc.deploymentBoosterSummaries.groupedAggregates,
            ...result.data.deploymentBoosterSummaries.groupedAggregates,
          ];
          acc.deployments.nodes = [...acc.deployments.nodes, ...result.data.deployments.nodes];
          acc.indexerAllocationSummaries.groupedAggregates = [
            ...acc.indexerAllocationSummaries.groupedAggregates,
            ...result.data.indexerAllocationSummaries.groupedAggregates,
          ];
          acc.eraDeploymentRewards.groupedAggregates = [
            ...acc.eraDeploymentRewards.groupedAggregates,
            ...result.data.eraDeploymentRewards.groupedAggregates,
          ];
        }

        return acc;
      },
      {
        deployments: { nodes: [] },
        indexerAllocationSummaries: { groupedAggregates: [] },
        deploymentBoosterSummaries: { groupedAggregates: [] },
        eraDeploymentRewards: { groupedAggregates: [] },
      },
    );
  }, [allDeployments.data]);

  return {
    loading:
      allDeployments.loading ||
      allDeploymentsInfomations.loading ||
      !!(allDeployments.data?.totalCount && !allDeploymentsInfomations.data?.deployments.nodes.length),
    allDeployments: allDeployments.data,
    allDeploymentsInfomations: allDeploymentsInfomations.data,
  };
};
