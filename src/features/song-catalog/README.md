# Song catalog

**Owner:** @dextr5

osu!-style song select. Built-in beats come from `public/beats/beats.json` (`Beat[]`, see
`src/shared/types.ts`); players can add their own, stored in their browser only (IndexedDB).

- `SongCatalog.vue`: the menu. Card list (click, ↑/↓, mouse wheel, search) plus a details panel.
  Selecting a song loads it into `beatClock` and plays a preview. Emits `select(beat)` and
  `confirm(beat)` (button, Enter or double click), so the page decides what "pick" does.
- `AddSongForm.vue`: audio file, title, BPM (with tap tempo) and start offset.
- `useSongCatalog()`: shared list of built-in + custom beats, `addCustom()`, `removeCustom()`.
  Custom beats have `id` starting with `custom-` and a `blob:` URL in `file`.
- Demo: `/dev/clock`.

```vue
<SongCatalog @confirm="(beat) => router.push('/write')" />
```

Styling is plain Tailwind on purpose so the UI owner can restyle it.

Tracker tasks:

- [x] Scrollable menu like the osu! song select screen
- [x] Song details (title, bpm, creator)
- [x] Add custom song
