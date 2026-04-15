declare module 'qrcode.react' {
  import { FC, SVGProps } from 'react';

  interface QRCodeProps extends SVGProps<SVGSVGElement> {
    value: string;
    size?: number;
    bgColor?: string;
    fgColor?: string;
    level?: 'L' | 'M' | 'Q' | 'H';
    includeMargin?: boolean;
    renderAs?: 'canvas' | 'svg';
    imageSettings?: {
      src: string;
      x?: number;
      y?: number;
      height: number;
      width: number;
      excavate: boolean;
    };
  }

  const QRCode: FC<QRCodeProps>;
  export default QRCode;
}
