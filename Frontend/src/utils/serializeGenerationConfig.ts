import type { QrLayoutMode } from './badgeQrLayout';



type EditorConfig = {

  name: string;

  supportType: 'invitation' | 'badge';

  layoutOption: '1_col' | '2_col' | '3_col' | 'custom';

  customDimensions: { width: number; height: number };

  qrPosition: 'front' | 'back';

  qrBg: string;

  qrFg: string;

  qrLayoutMode: QrLayoutMode;

  qrContainerMm?: number;

  qrSizeMm: number;

  qrPosX: number;

  qrPosY: number;

  backgroundColor: string;

  backText: string;

  rowGap: number;

  colGap: number;

};



/** Config sérialisable envoyée au backend (sans File / blob URL). */

export function serializeGenerationConfig(

  config: EditorConfig,

  dims: { widthMm: number; heightMm: number; designWidthMm?: number }

) {

  return {

    name: config.name,

    supportType: config.supportType,

    layoutOption: config.layoutOption,

    customDimensions: config.customDimensions,

    qrPosition: config.qrPosition,

    qrBg: config.qrBg,

    qrFg: config.qrFg,

    qrLayoutMode: config.qrLayoutMode ?? 'margin',

    qrContainerMm: config.qrContainerMm ?? 50,

    qrSizeMm: config.qrSizeMm ?? 40,

    qrPosX: config.qrPosX ?? 50,

    qrPosY: config.qrPosY ?? 50,

    backgroundColor: config.backgroundColor,

    backText: config.backText,

    rowGap: config.rowGap,

    colGap: config.colGap,

    widthMm: dims.widthMm,

    heightMm: dims.heightMm,

    designWidthMm: dims.designWidthMm,

  };

}

