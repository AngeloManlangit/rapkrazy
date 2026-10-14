/**
 * Robot TTS contract. Must return real audio (not browser speechSynthesis) so the robot
 * can be scheduled on the beat, mixed with the track, and captured by video export.
 * Engine choice is still open; see docs/ARCHITECTURE.md "Robot voice".
 */
export interface RobotVoice {
  /** Render `text` to audio. Implementations should cache by text + options. */
  synth(text: string, options?: RobotVoiceOptions): Promise<AudioBuffer>
}

export interface RobotVoiceOptions {
  /** Engine-specific pitch; lets the robot "sing" notes when supported. */
  pitch?: number
  /** Engine-specific speaking speed. */
  speed?: number
  /** Named voice preset (for the "different robot voices" stretch goal). */
  voice?: string
}
