# weight log

a tiny daily weight tracker. type a number, hit save, watch the line.

i kept restarting the same notes app every few months for this. figured i'd just
build it once and stop fiddling. all the data lives in your browser, no account.

## what's in it

- one weight per day (re-entering the same date overwrites, that's on purpose)
- a chart with raw points and a 7-day moving average line over the top
- 30-day trend printed as kg/wk so you know which way the wind is blowing
- target line on the chart, plus a small "x kg above target" note
- localStorage, so it survives a reload but not a new browser

## the math part

the moving average is the obvious one, mean of the last 7 days of entries
(only days you actually logged, gaps don't pad).

the trend is a least-squares line fit to the last 30 days. day index on x,
weight on y. slope formula:

```
slope = (n*Σxy - Σx*Σy) / (n*Σx² - (Σx)²)
```

then i multiply by 7 to show kg per week, which reads more naturally than per day.
if the slope points toward your target, the target hint also shows a rough ETA
(diff / slope, in days). it's noisy with few data points but settles down once
you have a couple of weeks logged.

## running it

no build step. open the html file. needs internet on first load for chart.js.

```
git clone https://github.com/secanakbulut/weight-log.git
cd weight-log
open index.html
```

## files

- `index.html` markup
- `style.css` the look
- `app.js` storage, math, chart wiring

## license

source available under PolyForm Noncommercial 1.0.0, see `LICENSE`. personal use
is fine, no commercial use without asking.
