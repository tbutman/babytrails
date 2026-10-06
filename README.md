# BabyTrails

**Your baby's growth records, private and in one place.** BabyTrails is a web app for keeping a
baby's measurements on WHO growth charts, storing documents like growth reports and doctor's notes,
and getting plain-language summaries of what's changed.

**Status: early development.** Nothing here is ready to use yet. The plan and its reasoning will be
in `SPEC.md` once it's written.

## The idea

- **Your records stay on your device.** Everything you enter or upload is stored, encrypted, in your
  own browser. There are no accounts and no server database, and the website only serves the app's
  files.
- **AI is optional and uses your own key.** If you choose an AI feature, your browser sends that
  request straight to the AI provider with your own API key. Nothing goes through our server.
- **Not medical advice.** BabyTrails keeps records, draws charts and explains numbers. It doesn't
  diagnose anything; that's your paediatrician's job.

## Licence

Free and open source under the [MIT licence](LICENSE).
