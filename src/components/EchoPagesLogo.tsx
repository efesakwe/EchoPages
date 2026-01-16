import React from 'react'
import Image from 'next/image'

interface EchoPagesLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'dark' | 'light'
  showText?: boolean
  className?: string
  logoPath?: string
}

export default function EchoPagesLogo({
  size = 'md',
  variant = 'dark',
  showText = true,
  className = '',
  logoPath = '/logo.png', // Default path, can be overridden
}: EchoPagesLogoProps) {
  const sizeMap = {
    sm: { width: 120, height: 120, fontSize: 'text-lg' },
    md: { width: 200, height: 200, fontSize: 'text-2xl' },
    lg: { width: 300, height: 300, fontSize: 'text-3xl' },
    xl: { width: 400, height: 400, fontSize: 'text-4xl' },
  }

  const dimensions = sizeMap[size]

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Logo Image */}
      <div 
        className={`${variant === 'dark' ? 'bg-black p-6 rounded-2xl' : ''}`}
        style={{ width: dimensions.width, height: dimensions.height }}
      >
        <Image
          src={logoPath}
          alt="Echo Pages Logo"
          width={dimensions.width}
          height={dimensions.height}
          className="object-contain"
          priority
        />
      </div>

      {/* Text "Echo Pages" with Gradient */}
      {showText && (
        <h1
          className={`${dimensions.fontSize} font-bold mt-4 bg-clip-text text-transparent bg-gradient-to-r from-pink-500 via-purple-500 to-orange-500`}
        >
          Echo Pages
        </h1>
      )}
    </div>
  )
}
