"use client";

export function PlayerRegistrazione({ src }: { src: string }) {
  return (
    <audio controls preload="none" className="h-8 w-full min-w-[200px] max-w-[320px]">
      <source src={src} type="audio/wav" />
    </audio>
  );
}
