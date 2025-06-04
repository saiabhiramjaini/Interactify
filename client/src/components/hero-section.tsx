import React from "react";
import { Cover } from "@/components/ui/cover";

export function HeroSection() {
  return (
    <div>
      <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold max-w-7xl mx-auto text-center mt-6 relative z-20 py-6 bg-clip-text text-transparent bg-gradient-to-b from-neutral-800 via-neutral-700 to-neutral-700 dark:from-neutral-800 dark:via-white dark:to-white">
        Build interactive presentations <br /> at <Cover className="text-4xl md:text-5xl lg:text-7xl">warp speed</Cover> with <Cover className="text-4xl md:text-5xl lg:text-7xl">Interactify</Cover>
      </h1>
    </div>
  );
}
