import { onScopeDispose, readonly, ref, shallowRef } from 'vue'
import type { BeatClock } from './BeatClock'
import { StubBeatClock } from './StubBeatClock'

export type { BeatClock, Unsubscribe } from './BeatClock'
export type { RobotVoice, RobotVoiceOptions } from './RobotVoice'
export * from './timing'

/** The one clock the whole app shares. Swapped for the Web Audio player in Phase 1. */
export const beatClock: BeatClock = new StubBeatClock()

/**
 * Reactive view of the shared clock for components. `position` updates on every beat and
 * state change; poll `clock.currentTime()` in requestAnimationFrame for smooth progress bars.
 */
export function useBeatClock() {
  const clock = beatClock
  const isPlaying = ref(clock.isPlaying)
  const position = shallowRef(clock.position())

  const sync = () => {
    isPlaying.value = clock.isPlaying
    position.value = clock.position()
  }
  const offBeat = clock.onBeat((pos) => (position.value = pos))
  const offState = clock.onStateChange(sync)
  onScopeDispose(() => {
    offBeat()
    offState()
  })

  return { clock, isPlaying: readonly(isPlaying), position: readonly(position) }
}
