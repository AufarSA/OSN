# OSN SpeedLab

A personal OSN Mathematics speed-training quiz built with plain HTML, CSS, and JavaScript. It runs on GitHub Pages and requires no backend or paid API.

## Features

- Three modes: Mental Math, Method Recall, and Mixed Mode.
- Configurable per-question timer (3–120 seconds); each question can override the default.
- Multiple-choice and numeric-answer questions.
- Built-in JSON question bank and custom question editor.
- Automatic advance after an answer or timeout.
- Answers and explanations are hidden during the session and shown in the final review.
- Results: score, accuracy, average response time, timeouts, and session history.
- Custom questions, settings, and results stored in browser `localStorage`.
- Import a JSON bank into the current browser.
- Responsive layout and keyboard shortcuts.

## Run it locally

Because the site loads `questions.json` with `fetch()`, don't open `index.html` directly as a `file://` URL. Use a local static server.

### Option A: VS Code Live Server
1. Open the project folder in VS Code.
2. Install the **Live Server** extension if you don't have it.
3. Right-click `index.html` and choose **Open with Live Server**.

### Option B: Python
In a terminal inside this folder, run:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Publish with GitHub Pages

1. Sign in to GitHub and create a repository, e.g. `osn-speedlab`.
2. Upload these files to the repository root:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `questions.json`
   - `README.md`
3. Open **Settings → Pages** in the repository.
4. Under **Build and deployment**, select **Deploy from a branch**.
5. Select your default branch (usually `main`) and folder `/ (root)`, then click **Save**.
6. Wait for GitHub Pages to publish. The site URL will appear in the Pages settings, usually:
   `https://YOUR-USERNAME.github.io/osn-speedlab/`

No build step is required. The repository can be public or private subject to your GitHub Pages plan/settings.

## LaTeX math rendering

Questions, multiple-choice options, answers, and explanations can include LaTeX. The page uses MathJax 3, loaded from jsDelivr, and supports inline math with `$...$` or `\\(...\\)` and display math with `$$...$$` or `\\[...\\]`. Display math is best placed on its own line. A network connection is required for MathJax to load.

When editing `questions.json`, escape each LaTeX backslash because the question bank is JSON. For example:

```json
{
  "id": "alg-latex-001",
  "mode": "method",
  "topic": "Fractions",
  "difficulty": "Easy",
  "type": "multiple",
  "question": "Evaluate $\\frac{1}{2} + \\frac{1}{3}$.",
  "options": ["$\\frac{5}{6}$", "$\\frac{2}{5}$", "$\\frac{1}{6}$"],
  "answer": "$\\frac{5}{6}$",
  "explanation": "The sum is $\\frac{3}{6} + \\frac{2}{6} = \\frac{5}{6}$."
}
```

In the custom-question form, type the LaTeX backslashes normally; the doubled backslashes are only needed in JSON strings.

## Add or edit questions

Edit `questions.json`. It must be a JSON array of question objects. Example:

```json
[
  {
    "id": "nt-001",
    "mode": "mental",
    "topic": "Number Theory",
    "difficulty": "Medium",
    "type": "multiple",
    "question": "What is the remainder when 17 is divided by 5?",
    "options": ["1", "2", "3", "4"],
    "answer": "2",
    "explanation": "17 = 5 × 3 + 2.",
    "timeMultiplier": 1.2,
    "tags": ["remainders"]
  },
  {
    "id": "alg-001",
    "mode": "method",
    "topic": "Algebra",
    "difficulty": "Easy",
    "type": "numeric",
    "question": "What is 12 squared?",
    "answer": "144",
    "explanation": "12 × 12 = 144.",
    "timeMultiplier": 0.8,
    "tags": ["squares"]
  }
]
```

### Required fields

- `mode`: `"mental"` or `"method"`. Mixed Mode combines both.
- `type`: `"multiple"` or `"numeric"`.
- `question`: the question prompt.
- `answer`: exact correct answer as a string.
- `options`: required for multiple choice; 2–6 options, with the correct answer matching one option.
- `timeMultiplier`: optional multiplier for the session pace (default `1.0`). For example, a 30-second pace with `1.2` gives 36 seconds; `0.8` gives 24 seconds.
- `topic`, `difficulty`, `explanation`, and `tags` are optional (defaults are supplied where possible).

**Numeric answer note:** Numeric answers are compared as normalized text. For example, `1/2` and `0.5` are considered different answers. For exact matching, make sure the expected answer format is clear in the question. This first version is designed for numerical values and simple exact answers, not symbolic algebra equivalence.

## Storage and privacy notes

- Your custom questions, settings, and quiz history are stored in the browser on the current device.
- `localStorage` is scoped to the site origin. Your data won't automatically sync to another device or browser.
- Editing `questions.json` in GitHub updates the shared built-in bank after the site redeploys.
- Imported question banks are added to local browser storage; they do not change the GitHub repository.
- Clearing site data in your browser can erase locally saved questions and results. Export important custom content separately by keeping a copy of it.

## Keyboard shortcuts

- `1`–`6`: select the corresponding multiple-choice option.
- `Enter`: submit the answer (or submit from the numeric field).
- `Esc`: ask to exit the current session.

## Known limitations in v1

- No accounts or cross-device synchronization.
- Numeric answers use normalized text matching, not symbolic math equivalence.
- Question content and answer keys should be checked before use; this is a training tool, not an official OSN assessment platform.
