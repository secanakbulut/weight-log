# weight log

a tiny daily weight tracker. type a number, hit save, watch the line.

i kept restarting the same notes app every few months for this. figured i'd just
build it once and stop fiddling. all the data lives in your browser, no account.

## what it does

- one weight per day (re-entering the same date overwrites)
- list of entries with edit and delete
- chart with raw points plus a 7-day moving average line over the top

the moving average only counts days you actually logged, so a missed week
doesn't drag the line down with zeros.

## running it

no build step. open the html file. needs internet on first load for chart.js.

```
git clone https://github.com/secanakbulut/weight-log.git
cd weight-log
open index.html
```

## license

source available under PolyForm Noncommercial 1.0.0, see `LICENSE`.
