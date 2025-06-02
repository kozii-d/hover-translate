import { ComponentProps, FC } from "react";

export interface CryptoData {
  id: string;
  networkName: string;
  networkType: string; // ERC-20, TRC-20, BEP-20, etc.
  tokens: string[];
  address: string;
  warningKey?: string;
  Icon: FC<ComponentProps<"svg">>
}