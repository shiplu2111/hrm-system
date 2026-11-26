import Image from 'next/image';

export interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  sizes?: string;
  priority?: boolean;
  className?: string;
}

/**
 * Wrapper around `next/image` providing modern AVIF/WebP delivery,
 * explicit dimensions to eliminate layout shift, and lazy loading below the fold.
 */
export function OptimizedImage({
  src,
  alt,
  width = 1200,
  height = 675,
  sizes = '(max-width: 768px) 100vw, (max-width: 1200px) 90vw, 896px',
  priority = false,
  className = '',
}: OptimizedImageProps) {
  const cleanSrc = src.trim();
  const isSvg = /\.svg(\?.*)?$/i.test(cleanSrc);

  return (
    <Image
      src={cleanSrc}
      alt={alt}
      width={width}
      height={height}
      sizes={sizes}
      priority={priority}
      loading={priority ? undefined : 'lazy'}
      decoding="async"
      unoptimized={isSvg}
      className={className}
    />
  );
}
