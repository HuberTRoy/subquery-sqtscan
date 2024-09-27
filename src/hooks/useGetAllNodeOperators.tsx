import { useMemo } from 'react';
import { gql, useLazyQuery } from '@apollo/client';

import { useAsyncMemo } from './useAsyncMemo';
import { useEra } from './useEra';
import { CurrentEraValue } from './useEraValue';

export const useGetAllNodeOperators = (props: { selectEra: number }) => {
  const { currentEra } = useEra();

  const { selectEra } = props;

  const blockHeightOfQuery = useMemo(() => {
    if (!currentEra.data?.index) return '99999999999999999';

    if (selectEra === currentEra.data.index - 1 || selectEra === currentEra.data.index) {
      return '99999999999999999';
    }

    return currentEra.data.eras?.find((i) => parseInt(i.id, 16) === selectEra)?.createdBlock || '99999999999999999';
  }, [selectEra, currentEra.data?.index]);

  const [fetchAllOperator] = useLazyQuery<{
    indexers: {
      nodes: { selfStake: CurrentEraValue; totalStake: CurrentEraValue; id: string }[];
      totalCount: number;
    };
  }>(gql`
    query getAllIndexers($first: Int! = 30, $offset: Int! = 0, $blockHeight: String!) {
      indexers(
        blockHeight: $blockHeight
        first: $first
        offset: $offset
        filter: { active: { equalTo: true } }
        orderBy: TOTAL_STAKE_DESC
      ) {
        nodes {
          selfStake
          totalStake
          id
        }
        totalCount
      }
    }
  `);

  const [fetchAllNodeOperatorInfomations] = useLazyQuery<{
    eraIndexerApies: {
      nodes: {
        indexerId: string;
        indexerApy: string;
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
  }>(gql`
    query getIndexerRewardsInfos($indexers: [String!], $era: Int!) {
      eraIndexerApies(filter: { eraIdx: { equalTo: $era }, indexerId: { in: $indexers } }) {
        nodes {
          indexerId
          indexerApy
        }
      }

      indexerEraDeploymentRewards(filter: { eraIdx: { equalTo: $era }, indexerId: { in: $indexers } }) {
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
  `);

  const allNodeOperators = useAsyncMemo(async () => {
    if (!selectEra) return { nodes: [], totalCount: 0 };
    let currentOffset = 0;
    const res = await fetchAllOperator({
      variables: {
        blockHeight: blockHeightOfQuery,
        first: 100,
        offset: 0,
      },
    });

    const result = res.data?.indexers || { nodes: [], totalCount: 0 };
    const resultTotal = res.data?.indexers.totalCount || 0;
    while (currentOffset < resultTotal) {
      currentOffset += 100;
      const res = await fetchAllOperator({
        variables: {
          blockHeight: blockHeightOfQuery,
          first: 100,
          offset: currentOffset,
        },
      });

      result.nodes = result.nodes.concat(res.data?.indexers.nodes || []);
    }

    return result;
  }, [selectEra]);

  const allNodeOperatorInformations = useAsyncMemo(async () => {
    if (!allNodeOperators.data?.nodes.length)
      return {
        eraIndexerApies: { nodes: [] },
        indexerEraDeploymentRewards: { groupedAggregates: [] },
      };
    const indexerIds = allNodeOperators.data?.nodes.map((node) => node.id);

    const chunkedIndexerIds: string[][] = [];
    for (let i = 0; i < indexerIds.length; i += 100) {
      chunkedIndexerIds.push(indexerIds.slice(i, i + 100));
    }

    const results = await Promise.all(
      chunkedIndexerIds.map((chunk) =>
        fetchAllNodeOperatorInfomations({
          variables: {
            indexers: chunk,
            era: selectEra,
          },
        }),
      ),
    );

    // Combine results from all chunks
    return results.reduce(
      (
        acc: {
          eraIndexerApies: { nodes: any[] };
          indexerEraDeploymentRewards: { groupedAggregates: any[] };
        },
        result,
      ) => {
        if (result.data) {
          acc.eraIndexerApies.nodes = [...acc.eraIndexerApies.nodes, ...result.data.eraIndexerApies.nodes];
          acc.indexerEraDeploymentRewards.groupedAggregates = [
            ...acc.indexerEraDeploymentRewards.groupedAggregates,
            ...result.data.indexerEraDeploymentRewards.groupedAggregates,
          ];
        }

        return acc;
      },
      {
        eraIndexerApies: { nodes: [] },
        indexerEraDeploymentRewards: { groupedAggregates: [] },
      },
    );
  }, [allNodeOperators.data]);

  return {
    loading:
      allNodeOperators.loading ||
      allNodeOperatorInformations.loading ||
      !!(
        allNodeOperators.data?.totalCount &&
        !allNodeOperatorInformations.data?.indexerEraDeploymentRewards.groupedAggregates.length
      ),
    allNodeOperators: allNodeOperators.data,
    allNodeOperatorInformations: allNodeOperatorInformations.data,
  };
};
