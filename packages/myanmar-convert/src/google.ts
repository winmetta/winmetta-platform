// myanmar-tools has no types. The reference lets apps that import this package see the declarations.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- see above
/// <reference path="./myanmar-tools.d.ts" />
// Google's myanmar-tools: the Zawgyi detector (a trained model) and the CLDR Zawgyi <-> Unicode rules.
// Pinned to 1.1.3: 1.2.0 on npm ships unbuilt sources and cannot be loaded.

import { installBufferShim } from './buffer-shim.ts';
import tools from 'myanmar-tools';

installBufferShim();

let detector: InstanceType<typeof tools.ZawgyiDetector> | undefined;
let converter: InstanceType<typeof tools.ZawgyiConverter> | undefined;

/** Created on first use: the detector loads its model when constructed. */
export function zawgyiDetector() {
  detector ??= new tools.ZawgyiDetector();
  return detector;
}

export function zawgyiConverter() {
  converter ??= new tools.ZawgyiConverter();
  return converter;
}
