# mergeverdict

Paste a unified diff (the page includes a sample). Laya chooses `merge`, `hold`, or `revert`. `min_confidence` is 0.6, and an abstention is hold. The verdict quotes one added line from the diff, or a context line if there is no added line. The server copies that line from the diff text. The page renders the verdict only when that quote is a full line of the diff; otherwise it does not render the verdict. This app never calls GitHub and never merges. There is no mock score path, and the client does not read `action.act_probability`.

## Setup

Python 3.10 or newer.

```bash
python -m pip install laya
```

The first decision downloads weights from https://huggingface.co/convaiinnovations/laya. Boot does not download them.

## Sidecar

```bash
python3 sidecar.py
```

Listens on `127.0.0.1:8105`. It calls `laya.Router.predict` on `POST /v1/systemone`. If Laya is not installed or a predict cannot reach a loaded model, the sidecar returns HTTP 503 `{"error":"Laya not running"}` and does not invent scores.

This sidecar is not the archived third-party `laya-serve` package. That package is a fake unless `LAYA_SERVE_BACKEND=laya`. Do not point mergeverdict at a fake. If you replace this sidecar with that package anyway, set `LAYA_SERVE_BACKEND=laya` or it will return scores with no model. Official `laya[serve]` (`laya-serve` from `pip install "laya[serve]"`) is a real Router and does not use that variable.

`LAYA_SIDECAR_PORT` changes the sidecar port. `LAYA_URL` (default `http://127.0.0.1:8105`) is what the Bun app calls.

## Web app

```bash
bun install && bun run dev
```

Listens on port 3005. `bun run start` runs without the file watcher. Open http://localhost:3005. If the sidecar cannot reach a loaded model, the page shows Laya not running.
