declare const __API_URL__: string;
declare const __DEV__: boolean;

declare module "color-rgba" {
  export default function rgba(
    color: string | number | (string | number)[]
  ): [number, number, number, number] | [];
}