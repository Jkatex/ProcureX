/* Supports the custom elements d ts client workflow with reusable logic kept close to the screens that consume it. */
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type DotLottiePlayerProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
  src?: string;
  background?: string;
  speed?: string | number;
  loop?: boolean;
  autoplay?: boolean;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'dotlottie-player': DotLottiePlayerProps;
    }
  }
}
