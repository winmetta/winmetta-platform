// myanmar-tools 1.1.3 ships no types. Only the parts this package uses are declared.
declare module 'myanmar-tools' {
  export class ZawgyiDetector {
    getZawgyiProbability(text: string): number;
  }
  export class ZawgyiConverter {
    zawgyiToUnicode(text: string): string;
    unicodeToZawgyi(text: string): string;
  }
  const tools: {
    ZawgyiDetector: typeof ZawgyiDetector;
    ZawgyiConverter: typeof ZawgyiConverter;
  };
  export default tools;
}
