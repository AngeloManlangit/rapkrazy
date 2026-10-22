import { computed, reactive, ref } from 'vue'
import { requestLyrics, type WriterContext } from './lyricsService'
import type { GeneratedLyrics, WriterInputs, WriterStatus } from '@/shared/types'

/** `getContext` lets the panel pass the current beat's bars / bpm at generate time. */
export function useAiWriter(getContext: () => WriterContext = () => ({})) {
    const inputs = reactive<WriterInputs>({ subject: '', action: '', adjective: '', topic: '' })
    const status = ref<WriterStatus>('form')
    const result = ref<GeneratedLyrics | null>(null)
    const error = ref('')
    let runId = 0 // lets us ignore responses that arrive after the dialog closed

    const canSubmit = computed(() => Object.values(inputs).every((v) => v.trim().length > 0))

    async function generate() {
        if (!canSubmit.value) return
        const id = ++runId
        status.value = 'loading'
        error.value = ''
        try {
            const trimmed = Object.fromEntries(
                Object.entries(inputs).map(([k, v]) => [k, v.trim()]),
            ) as unknown as WriterInputs
            const data = await requestLyrics(trimmed, getContext())
            if (id !== runId) return
            result.value = data
            status.value = 'result'
        } catch (e) {
            if (id !== runId) return
            error.value = (e as Error).message || 'Something went wrong. Try again.'
            status.value = 'error'
        }
    }

    function backToForm() {
        status.value = 'form'
    }

    /** Call when the dialog closes: cancels any in-flight result. */
    function reset() {
        runId++
        status.value = 'form'
        result.value = null
        error.value = ''
    }

    return { inputs, status, result, error, canSubmit, generate, backToForm, reset }
}
