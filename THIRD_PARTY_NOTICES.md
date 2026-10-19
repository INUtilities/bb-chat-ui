# Third-party icon notices

The project LICENSE covers original bb-chat-ui code. The copied icon geometry below
remains under its original copyright and license. No icon package is installed or
loaded at runtime. Keep this file when distributing the source or packaged plugin.
The complete notices are also retained in the app module's thirdPartyIconNotices export so
that distributing app.js alone does not omit them.

## Hugeicons free Stroke Rounded icons — MIT

Source revision: c1b280d3964e115dfdefb58241f6d93ca68f7b6d.
License: https://github.com/hugeicons/hugeicons/blob/c1b280d3964e115dfdefb58241f6d93ca68f7b6d/LICENSE.md

| Local use | Source SVG under https://github.com/hugeicons/hugeicons/blob/c1b280d3964e115dfdefb58241f6d93ca68f7b6d/icons/ |
| --- | --- |
| app.tsx: bb-chat-ui-queue | message-delay-02.svg |
| lib/composer-diff-icons.ts: DiffModified | square-dot.svg |
| lib/composer-diff-icons.ts: DiffAdded (including untracked files) | add-square.svg |
| lib/composer-diff-icons.ts: DiffRemoved | minus-sign-square.svg |
| lib/composer-diff-icons.ts: DiffRenamed | square-arrow-right-01.svg |
| lib/composer-diff-icons.ts: DiffConflict | alert-square.svg |
| lib/composer-diff-icons.ts: Copy | copy-01.svg |
| lib/composer-diff-icons.ts: CircleQuestion | help-circle.svg |

Adaptations: SVG geometry is rendered with React or DOM APIs; paint uses
currentColor. The paths and help-circle circle coordinates match the source.

MIT License

Copyright (c) 2025 Hugeicons

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Lucide 0.300.0 — ISC

License: https://github.com/lucide-icons/lucide/blob/0.300.0/LICENSE

- app.tsx: bb-chat-ui-status — https://github.com/lucide-icons/lucide/blob/0.300.0/icons/activity.svg
- lib/quote-pill.ts: QUOTE_ICON — https://github.com/lucide-icons/lucide/blob/0.300.0/icons/quote.svg
- lib/user-attachments.ts: FILE_ICON — https://github.com/lucide-icons/lucide/blob/0.300.0/icons/file.svg

The status path matches this release. Its original copying route was not recorded;
this release is the verified source used for attribution. The quote and file SVGs
were replaced directly from this release on 2026-10-19.

Adaptations: activity uses React and currentColor; quote and file use a black stroke
as a CSS alpha mask, omit fixed SVG dimensions, and inherit the surrounding text
color through CSS. Quote is rotated 180 degrees to display an opening quote and scaled to 85%
around its center. The CSS icon box dimensions remain unchanged.

ISC License

Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022 as part of Feather (MIT). All other copyright (c) for Lucide are held by Lucide Contributors 2022.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

## Feather — MIT (inherited icon geometry)

Lucide's license credits Feather. The activity geometry also matches Feather's
activity icon. Preserve this upstream notice alongside Lucide's notice.
Source: https://github.com/feathericons/feather/blob/v4.29.2/icons/activity.svg
License: https://github.com/feathericons/feather/blob/v4.29.2/LICENSE

The MIT License (MIT)

Copyright (c) 2013-2023 Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
