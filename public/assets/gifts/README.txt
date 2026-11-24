# Alpha Mate — Three animated gift assets

These files are bundled in `public/assets/gifts/` and are referenced by the shared Firestore
gift records created by the Admin backend:
- gift_5651 — Golden Dove Heart (8.388 s WebM + PNG thumbnail)
- gift_6331 — Butterfly Heart (5.100 s WebM + PNG thumbnail)
- gift_6370 — Snow Leopard (6.043 s WebM + PNG thumbnail)

Playback uses the existing `UniversalGiftPlayer` WebM video path. The PNG is only the Gift Box
thumbnail; sending the gift triggers the WEBM animation overlay.

IMPORTANT: the source MP4 files had no alpha channel. Their WEBM conversions are opaque
VP9 videos, not transparent videos. `semi_transparent` mode and edge feathering are used so
the rectangular frame is softened; this does not remove the original video background.

Admin-created Firestore documents use IDs gift_5651, gift_6331 and gift_6370. Starter coin
value is 10 for each and can be edited in Gift Management after the initial catalog sync.
