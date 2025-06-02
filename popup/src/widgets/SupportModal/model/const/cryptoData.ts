import type { CryptoData } from "../../types/cryptoData.ts";
import EthIcon from "../../assets/cryptoIcons/eth-logo.svg?react";
import BtcIcon from "../../assets/cryptoIcons/btc-logo.svg?react";
import TronIcon from "../../assets/cryptoIcons/trx-logo.svg?react";
import BnbIcon from "../../assets/cryptoIcons/bnb-logo.svg?react";
import SolanaIcon from "../../assets/cryptoIcons/sol-logo.svg?react";

export const CRYPTO_DATA: CryptoData[] = [
  {
    id: "eth",
    networkName: "Ethereum Network",
    networkType: "ERC-20",
    tokens: ["ETH", "USDT", "USDC"],
    address: "0xd3DdA3BFbcf5cB8D61a1Aa22CD9B1a974b396c72",
    Icon: EthIcon,
  },
  {
    id: "btc",
    networkName: "Bitcoin Network",
    networkType: "Bitcoin",
    tokens: ["BTC"],
    address: "bc1qlum54a7zcwya0f5lyfa2se0rnexxw0akq6fhka",
    Icon: BtcIcon,
  },
  {
    id: "tron",
    networkName: "Tron Network",
    networkType: "TRC-20",
    tokens: ["TRX", "USDT", "USDC"],
    address: "TYjN46zDQF5FnYRVtc6ED2jaTB9bZyGTrJ",
    Icon: TronIcon,
  },
  {
    id: "bnb",
    networkName: "BNB Smart Chain",
    networkType: "BEP-20",
    tokens: ["BNB", "USDT", "USDC", "BUSD"],
    address: "0xd3DdA3BFbcf5cB8D61a1Aa22CD9B1a974b396c72",
    warningKey: "support.warnings.bnb",
    Icon: BnbIcon,
  },
  {
    id: "solana",
    networkName: "Solana Network",
    networkType: "SOL",
    tokens: ["SOL", "USDT", "USDC"],
    address: "2ns9kehBpGQzNWHKd92pmwJjcAy2B9ZCatWtyoCkwKey",
    Icon: SolanaIcon,
  },
];