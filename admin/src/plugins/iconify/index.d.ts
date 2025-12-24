export interface IconData {
  prefix: string;
  width: number;
  height: number;
  icons: Record<string, {
    body: string;
  }>;
}

declare const icons: IconData;
export default icons;