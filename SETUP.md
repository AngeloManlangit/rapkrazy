# Running Rapkrazy on your own computer

This is how to get the game running so you can try it. It takes about 10 minutes.

## What you need first

- **Node.js**, version 22.18 or newer (24 works too). Get it at nodejs.org. Check yours with `node -v`.
- **Git**. Check with `git --version`.
- A **Chrome or Edge** browser. The robot voice works best there.
- Two things from Cole: the **Supabase URL** and the **Supabase anon key**. Ask him for them. Without these, only the Write page works and Collab shows a "needs Supabase" message.

## 1. Get the code

```bash
git clone https://github.com/AngeloManlangit/rapkrazy.git
cd rapkrazy
git checkout feature/multiplayer
```

The Collab and Settings pages live on the `feature/multiplayer` branch for now. Once it's merged you can stay on `main`.

## 2. Install

```bash
npm install
```

This can take a minute. Some warnings about "vulnerabilities" are normal, ignore them.

## 3. Add the keys

Make a new file called `.env` in the main folder (the same place `package.json` is). Copy this into it and fill in what Cole sent you:

```
VITE_SUPABASE_URL=paste-the-url-here
VITE_SUPABASE_ANON_KEY=paste-the-anon-key-here
VITE_AI_WRITER_MOCK=false
```

A few things people trip on:

- The file is named `.env`. Not `.env.txt`, and not `.env.example`.
- Don't put the keys in `.env.example`. That file gets uploaded to GitHub. `.env` stays on your computer only.
- No spaces around the `=` and no quotes.
- Leave out `VITE_GEMINI_API_KEY`. The AI writer runs through Cole's server, so you don't need your own key.

## 4. Start it

```bash
npm run dev
```

It prints a link, usually `http://localhost:5173`. Open it in your browser.

If you change `.env` later, stop the server (Ctrl+C) and start it again. It only reads the file when it starts.

## What to try

**Write** (the first button on the home page)
- Pick a song with CHOOSE SONG, type some lyrics, and click the robot to hear it rap them.
- The Random template button fills in a fill-in-the-blanks verse.
- The AI ghostwriter asks for a noun, a verb, an adjective and a topic, then writes bars for you. If you see "the AI is resting", it used the backup lyrics because something couldn't connect.

**Settings**
- Family-friendly is the default. Ghetto mode lets the AI cuss and trash-talk. It still won't write slurs.
- This only changes the AI writer. It doesn't affect Collab.

**Collab** (play with a friend). For now Collab is Rhyme Duel only. The line-by-line writing mode is hidden.

Tip: you can test alone by opening a normal window and a private window. They count as different players.

**Rhyme Duel** (2 players, uses your microphone)
1. One person picks a nickname and clicks **Create lobby**. They get a 6-letter code, pick a beat, and choose how many words each player writes (2 to 8). One friend joins with the code.
2. Each of you has 45 seconds to type ending words for the other person.
3. Once you both lock in, there is a 10 second countdown and then the rap starts by itself. You can skip the wait by clicking **Start rapping**.
4. Each of you raps one bar per word over the beat on the mic. A counter shows the beats, and the last beat of each bar is where your rhyme has to land.
5. The app listens, checks the rhymes and the timing, blows the air horn, and shows who won. Same score means a tie.

Please use headphones for this one. Without them the mic picks up the beat and the timing check gets confused. The browser will ask to use your mic the first time, so click Allow.

## When something goes wrong

**"Could not sign in" when hosting or joining.** Anonymous sign-ins aren't turned on in Supabase. Tell Cole.

**Collab says it needs Supabase.** Your `.env` is missing, misnamed, or empty. Fix it, then restart `npm run dev`.

**Page is blank or shows an import error about `@fontsource`.** Run `npm install` again.

**"The AI is resting" every time.** Check the browser console (F12) for a line starting with "AI Writer fell back". It usually means the keys in `.env` are wrong or the server is down.

**The mic is blocked.** Click the lock icon in the address bar and allow the microphone for this site, then try again.

**No sound.** Browsers block audio until you click something. Click the play button or the robot first.

**The robot says "No voice".** Refresh the page. If it keeps happening, try Chrome.

**`npm install` complains about the Node version.** Update Node. Anything under 22.18 is too old.

## Please don't

- Commit your `.env` file or post the keys anywhere public.
- Push straight to `main`. Make a branch and open a pull request.
