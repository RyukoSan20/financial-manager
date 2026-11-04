# The ten points, and the merchant capture flow

Every line here is a promise to the person who wrote them. Each point
carries the state it is actually in, and the way it was checked. A
point is only "done" when it runs in production, not when it compiles.

The rule that governs this file: a point is not done because the code
looks finished. It is done when a person on a phone can use it and see
it work. So every point below carries how it was verified, and the
verification is the thing that decides.

---

## 1. Settings — the left side, the logo, the glass

The complaint was that the settings page still looks stiff, that the
logo needs work, and that the panels do not share the Dashboard's
layered look.

- [ ] The header and the main panel take the glass treatment
- [ ] The profile card and the navigation items carry a thin glowing
      border and a smooth hover
- [ ] The logo is the revised vector, not the old one

How it will be checked: the panels are read back out of the live
page for their backdrop filter and their shadow, the hover is
triggered and the border is read again, and the page is measured at
three widths for overflow.

## 2. Dashboard — the logo and the background

The complaint was that the top left logo and the dashboard background
are too plain.

- [ ] The logo is the custom vector with the dynamic gradient and glow
- [ ] The background is the soft aurora mesh, not a flat grey
- [ ] The aurora flag is on in CI and in deploy

How it will be checked: the aurora blobs are counted in the live DOM
and the background is sampled for colour, at desktop and at mobile.

## 3. Add transaction — quantity multiplied by the unit price

The complaint was that the total does not come out on its own when
you buy two of something.

- [ ] The quick entry parser reads "2 indomie 3500" and "ayam 4 @ 35rb"
- [ ] The form shows the quantity, the unit price and the total as you
      type
- [ ] The backend voice parser agrees with the frontend parser

How it will be checked: the parser is tested against the patterns the
person actually types, the total is read out of the live form, and
the backend and the frontend are given the same sentence and asked
for the same number.

## 4. Transactions — the itemised breakdown can be edited

The complaint was that the line items cannot be edited, that they
cannot be arranged, and that discount and tax are missing.

- [ ] Each line item has an edit control in the history card
- [ ] The breakdown modal has a discount column and a tax column
- [ ] The clean total follows from the items, the discount and the tax

How it will be checked: the arithmetic is checked against the tax
rules on the server, the edit is made in the browser, and the total
is read back after the edit.

## 5. Market — the page becomes a workspace you can talk to

The complaint was that the dashboard is the wrong name for the page
and that there is no way to ask a question about a stock.

- [ ] The page is laid out as an AI Market Assistant workspace
- [ ] The chat sits next to the chart, not buried below it
- [ ] A question about a ticker gets an answer that uses the real
      numbers on the page

How it will be checked: a question is typed in the live page and the
answer is read back, and it is checked that the answer names the
ticker and the figures that the page is showing.

## 6. Goals — the cards move, and the cost can be edited

The complaint was that the icons are stiff, that the cost breakdown
from the AI cannot be edited, and that the goals cannot be dragged
between the quadrants.

- [ ] The goal cards carry the tilt, and the icons are custom and
      animated
- [ ] The cost lines can be edited in place
- [ ] A goal can be dragged from one quadrant to another and the move
      is kept

How it will be checked: the drag is performed in the browser and the
goal is read back in its new quadrant, and the cost edit is made and
read back.

## 7. Split bill — you choose who had what

The complaint was that the split does not follow the receipt, that
there is no way to give item A to one person and item B to another.

- [ ] The items on the receipt can be assigned to a member, by
      ticking or by dragging
- [ ] Each person's share counts their own items and their part of the
      tax and the discount
- [ ] What is owed to you and what you owe follow from that

How it will be checked: the assignment is made in the live page and
the balances are read back, and they are checked against the amount
that is owed by hand.

## 8. Map — the address is specific, and the pin says what it is

The complaint was that the address only names the district, and that
the minimarket and the supermarket get the same pin.

- [ ] The reverse geocoding returns the street and the nearest place
- [ ] The pin follows the category, with its own drawing and colour
- [ ] A place can be given its own pin

How it will be checked: the address that comes back is read for the
street or the place name, and the pin that is drawn is checked
against the category of the place.

## 9. Health coach — it stops looking like a table of numbers

The complaint was that the page is static and stiff, and that it does
not feel like the rest of the Money+ layer.

- [ ] The scores sit in a bento grid, the progress bars wave, and the
      money cards take the glass
- [ ] The ratios carry the pastel badge that says how they are doing

How it will be checked: the bento tiles are counted in the live page
and the bar animation is read back from the computed style, and the
page is measured at three widths.

## 10. Shopping — the catalogue is pictures, not a list of prices

The complaint was that the search does not show a picture, a
description and a price for each product.

- [ ] The search brings back a card per product, with the thumbnail,
      the price and the action
- [ ] The cards say where the number came from, and say it plainly
      when the number is a local catalogue and not the market's
- [ ] The direct store links are still there

How it will be checked: a real search is run in the live page and the
cards are counted and read back, and the local source is checked for
its label.

## The merchant flow: capture a product and it is in the catalogue

The flow the person drew, and what has to be true at each step.

1. The camera or the file chooser gives an image.
2. The AI reads the image and pulls out the name, the category, the
   price and the merchant.
3. The crop of the product is taken from the image and becomes the
   thumbnail.
4. The product is written to the catalogue and shows up as a card that
   moves.

- [ ] A picture of a product becomes a catalogue entry, with the
      picture on it
- [ ] The picture of the product is cut from the picture that was
      taken
- [ ] Nothing is written without the person saying yes

How it will be checked: a picture is put through the flow in the live
app, and the entry that comes out is read back with its name, its
price and its picture.

---

## The rules that go with the work

- A point that changes a screen the reader already sees sits behind a
  flag, unless it is a fix for something that was broken.
- The data and the preferences that are already on the account are
  never rewritten.
- The tests come first: a failing test for every fix, and no test is
  weakened to make it pass.
- No new dependency without asking.
- Anything synthetic stays synthetic, and no real user data is printed
  or committed.
- Work that is not mine is not touched, and the files are staged one
  at a time.
