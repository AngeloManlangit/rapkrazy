<template>
  <!-- Hand-inked line for the ink kit (ink.css). Wobble the shape, then add a second ink band
       whose width drifts 0-5px (dilate + displace with another noise), so strokes swell and taper. -->
  <svg width="0" height="0" style="position: absolute" aria-hidden="true" focusable="false">
    <defs>
      <filter
        id="rough"
        x="-20%"
        y="-40%"
        width="140%"
        height="180%"
        color-interpolation-filters="sRGB"
      >
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.035"
          numOctaves="2"
          seed="4"
          result="n1"
        />
        <feDisplacementMap
          in="SourceGraphic"
          in2="n1"
          scale="4"
          xChannelSelector="R"
          yChannelSelector="G"
          result="wob"
        />
        <feMorphology in="wob" operator="dilate" radius="1.5" result="fat" />
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.06"
          numOctaves="1"
          seed="11"
          result="n2"
        />
        <feDisplacementMap
          in="fat"
          in2="n2"
          scale="7"
          xChannelSelector="R"
          yChannelSelector="B"
          result="fatw"
        />
        <feFlood flood-color="#0b0614" />
        <feComposite in2="fatw" operator="in" result="edge" />
        <feMerge>
          <feMergeNode in="edge" />
          <feMergeNode in="wob" />
        </feMerge>
      </filter>
    </defs>
  </svg>
</template>
