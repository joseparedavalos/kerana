// Lógica pura del bucle de las pistas en archivo (S119): las curvas del fundido cruzado y cuándo toca entrar.

/**
 * Curvas de igual potencia para el fundido cruzado: la que entra sube con el seno y la que sale baja con el coseno, así
 * la suma de las potencias queda en 1 (dos pedazos distintos de la pista no se refuerzan ni se cancelan).
 */
export function crossfadeCurves(steps: number): { fadeIn: Float32Array; fadeOut: Float32Array } {
  const n = Math.max(2, steps);
  const fadeIn = new Float32Array(n);
  const fadeOut = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * (Math.PI / 2);
    fadeIn[i] = Math.sin(x);
    fadeOut[i] = Math.cos(x);
  }
  fadeIn[n - 1] = 1;
  fadeOut[n - 1] = 0;
  return { fadeIn, fadeOut };
}

/** Toca entrar en la vuelta siguiente: la pista llegó al comienzo de su fundido y no hay un fundido cruzado en curso. */
export function loopDue(position: number, fadeStart: number, crossfading: boolean): boolean {
  return !crossfading && position >= fadeStart;
}

/** Lo más largo (s) que el nivel estuvo por debajo de `floor` en una serie de muestras `[t, rms]` tomadas en orden. */
export function longestBelow(samples: readonly (readonly [number, number])[], floor: number): number {
  let longest = 0;
  let since = -1;
  for (const [t, v] of samples) {
    if (v < floor) {
      if (since < 0) since = t;
      longest = Math.max(longest, t - since);
    } else since = -1;
  }
  return longest;
}
