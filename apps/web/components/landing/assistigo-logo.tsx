import React from 'react';
import Image from 'next/image';

interface LogoProps {
  className?: string;
  height?: number;
}

export function AssistigoLogo({
  className = '',
  height = 80,
}: LogoProps) {
  return (
    <div className={`flex items-center shrink-0 ${className}`}>
      <Image
        src="/Bharatfill-logo.png"
        alt="Bharatfill - Smart Assistance, Seamless Solutions."
        width={480}
        height={160}
        style={{ height: height, width: 'auto' }}
        className="object-contain object-left"
        priority
      />
    </div>
  );
}
