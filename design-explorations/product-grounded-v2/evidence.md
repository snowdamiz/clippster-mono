# Product-grounded design exploration

Production landing and application source are unchanged by this exploration. Start `node design-explorations/product-grounded-v2/serve.cjs` from the repository root and open http://127.0.0.1:4186/.

## Deliverables

- `?concept=studio`: Open Studio. Cinematic dark canvas, large cyan typography, immersive player, light publishing chapter.
- `?concept=editorial`: Creator's Edition. Paper background, condensed display typography, numbered chapters, cyan Image Studio spread.
- `?concept=signal`: Signal & Control. Slate palette, light typography, source-to-result comparisons and tool closeups.
- `?concept=motion`: independent editor playback and calendar-to-dialog studies. Play, pause, replay, scrub, step buttons, and reduced motion.
- `exports/`: complete desktop screenshots at 1440px width.
- `captures/`: original application captures. The capture provider returned JPEG bytes under .png filenames; the included server supplies the correct media type.

## Directly explored

Navigated the running Clippster desktop application, opened an existing populated video project, scrubbed and played the timeline, inspected caption presets and the canvas-format menu. Inspected the source video library and an existing AI clipping session containing eight detected clips, their source ranges, descriptions, and scores. Opened a live Kick channel in the embedded player and inspected monitor controls. Opened Image Studio Beta and its actual template browser and tool rail. Dragged an existing built clip onto October 15 in Content Calendar, inspected the Schedule Clip dialog, and canceled it.

The editor, AI session, live stream, and calendar use different actual footage. Product pixels are captured, cropped, scaled, and composed; no application controls or dashboards were generated. Cyan focus outlines and the moving cursor in the motion study are explicitly labeled editorial annotations.

## Verification limits

- AI visuals are saved detection results. No new inference run was started, so the prototype does not simulate processing speed or success.
- The live player displayed footage, but its Clip button was disabled. Successful live capture was not verified or fabricated.
- The image editor project was empty. Only the verified tools and template browser are shown; no finished artwork or generated result is invented.
- Scheduling setup was inspected and canceled. No post was scheduled or published. Export success and external social delivery were not tested.
- Playback motion uses three authentic frames at roughly 00:45, 00:51, and 00:59. It is a storyboard, not continuous video or a demonstration of a new edit.

## Source checks

Reviewed `client/src/editor/components/EditorLayout.vue`, `TimelineToolbar.vue`, `ClipDetectionConfirmDialog.vue`, `client/src/pages/ContentCalendar.vue`, `landing/src/seo/productFacts.ts`, and `landing/src/index.css`. Used existing logo assets and repository fonts. Reviewed the current public Clippster homepage and LiveKit, Linear, and Final Cut Pro reference pages for hierarchy and product storytelling.

## Motion strategy

Open Studio: a restrained full-editor entrance, followed by playback states and a focused scheduling transition. Creator's Edition: crisp cuts between real product states tied to chapter changes. Signal & Control: sequential focus moves connecting source, decision, and destination. All directions should use recorded real interactions for any later continuous video, capture, or processing sequence.

The working prototype animates opacity and transforms, starts paused, pauses on hidden tabs, supports explicit reduced motion and the OS preference, and retains manual state controls.

## Quality review

Reviewed all three complete desktop renders for hierarchy, clipping, screenshot accuracy, composition variety, and asset loading. Corrected the light-theme logo rendering and hero CTA spacing. Verified playback advances, reduced motion pauses it, and the final scheduling state reveals the authentic dialog with zero transition duration in reduced-motion mode. These are design explorations, not production-ready responsive implementations.
