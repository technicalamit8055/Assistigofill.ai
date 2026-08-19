import React from 'react';
import Image from 'next/image';

interface LogoProps {
  className?: string;
  height?: number;
}

export function AssistigoLogo({
  className = '',
  height = 64,
}: LogoProps) {
  return (
    <div className={`flex items-center shrink-0 ${className}`}>
      <Image
        src="/assistfill-logo.png"
        alt="Assistigo.ai - Smart Assistance, Seamless Solutions."
        width={360}
        height={120}
        style={{ height: height, width: 'auto' }}
        className="object-contain object-left"
        priority
      />
    </div>
  );
}
