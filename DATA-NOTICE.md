# Growth data notice

BabyTrails' code is under the [MIT license](LICENSE). **The WHO growth data is not.**

The growth charts and z-scores use the **WHO Child Growth Standards**, © World Health Organization:
<https://www.who.int/tools/child-growth-standards>.

- WHO Multicentre Growth Reference Study Group. *WHO Child Growth Standards: Length/height-for-age,
  weight-for-age, weight-for-length, weight-for-height and body mass index-for-age: Methods and
  development.* Geneva: World Health Organization; 2006.
- WHO Multicentre Growth Reference Study Group. *WHO Child Growth Standards: Head
  circumference-for-age, arm circumference-for-age, triceps skinfold-for-age and subscapular
  skinfold-for-age: Methods and development.* Geneva: World Health Organization; 2007.
- WHO Multicentre Growth Reference Study Group. *WHO Child Growth Standards: Growth velocity based on
  weight, length and head circumference: Methods and development.* Geneva: World Health
  Organization; 2009. (Weight increments over 1- and 2-month intervals.)

The app uses the L, M and S values from WHO's published tables, unchanged and converted to JSON at
build time, in a free, non-commercial app, with acknowledgment of WHO and the source. WHO's
[terms of use](https://www.who.int/about/policies/terms-of-use) allow educational and other
non-commercial use. Thomas also wrote to WHO on October 7, 2026 to confirm this use. WHO does not
endorse this app.

**How the data gets into the app:** this repository never contains the tables. At build time,
`scripts/who-data.mjs` downloads WHO's "expanded tables" and weight velocity tables from who.int, checks each file against a
pinned SHA-256 checksum, and converts the L, M and S columns to JSON in `src/growth/data/`
(git-ignored). The built app contains that JSON.

If you fork BabyTrails, check WHO's terms for your own use, especially any commercial use.
