import axios from "axios";
import { Adapter, ChainBlocks, ProtocolType } from "../adapters/types";
import { CHAIN } from "../helpers/chains";
import { getBlock } from "../helpers/getBlock";
import { getUniqStartOfTodayTimestamp } from "../helpers/getUniSubgraphVolume";
import { getTimestampAtStartOfDayUTC, getTimestampAtStartOfNextDayUTC, getTimestampAtStartOfPreviousDayUTC } from "../utils/date";
import { getPrices } from "../utils/prices";
const { request, gql } = require("graphql-request");


const URL = 'https://api.thegraph.com/subgraphs/name/dmihal/arbitrum-fees-collected'
interface IValue {
  totalFeesETH: string;
}
interface IDailyResponse {
  yesterday: IValue;
  today: IValue;
}

interface ITx {
  value: string;
}

const getUniswapDateId = (date?: Date) => getUniqStartOfTodayTimestamp(date) / 86400;

const SEQUENCER_FEES = '0x18A08f3CA72DC4B5928c26648958655690b215ac'
const NETWORK_INFRA_FEES = '0x582A62dB643BCFF3B0Bf1DA45f812e3a354d7518'
const CONGESTION_FEES = '0xb04D2C62c0Cd8cec5691Cefd2E7CF041EBD26382'

const getWithdrawalTxs = async (address: string, startblock: number, endblock: number) => {
  const url = `https://api.arbiscan.io/api?module=account&action=txlist&address=${address}&startblock=${startblock}&endblock=${endblock}`;
  const data: ITx[] = await axios.get(url).then((e: any) => e.data.result).catch((err: any) => {
    console.log(`error get tx list: ${err}`);
    return [];
  });
  return data.reduce((acc, { value }) => acc + Number(value) / 1e18, 0)
};

const adapter: Adapter = {
  adapter: {
    [CHAIN.ARBITRUM]: {
        fetch:  async (timestamp: number, _: ChainBlocks) => {
          const todaysTimestamp = getTimestampAtStartOfDayUTC(timestamp)
          const yesterdaysTimestamp = getTimestampAtStartOfNextDayUTC(timestamp)

          const todaysId = getUniswapDateId(new Date(todaysTimestamp * 1000));
          const yesterdaysId = getUniswapDateId(new Date(yesterdaysTimestamp * 1000));

          const graphQueryDaily = gql
          `query fees {
            yesterday: fee(id: ${yesterdaysId}) {
              totalFeesETH
            }
            today: fee(id: ${todaysId}) {
              totalFeesETH
            }
          }`;

          const graphResDaily: IDailyResponse = await request(URL, graphQueryDaily);
          const pricesObj = await getPrices(["coingecko:ethereum"], todaysTimestamp);
          const feesETH = Number(graphResDaily.yesterday.totalFeesETH) - Number(graphResDaily.today.totalFeesETH);
          const dailyFees = feesETH * pricesObj["coingecko:ethereum"].price
          return {
              timestamp,
              totalFees: undefined,
              dailyFees: dailyFees.toString(),
              totalRevenue: "0",
              dailyRevenue: "0",
          };
        },
        start: async () => 1575158400
    },
},
  protocolType: ProtocolType.CHAIN
}

export default adapter;
