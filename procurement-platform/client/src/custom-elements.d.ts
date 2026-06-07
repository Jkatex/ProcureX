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
