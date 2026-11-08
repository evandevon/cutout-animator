# Cutout Animator

**Open it here: <https://evandevon.github.io/cutout-animator/>**

[![Cutout Animator: a drawing cut out and placed on a stage](docs/screenshot.png)](https://evandevon.github.io/cutout-animator/)

Make an animation from your own drawings. Photograph a drawing, cut it out, arrange the cutouts on a stage, then press Record and tell the story while dragging them around. It works with a mouse or a touch screen, on phones, tablets, computers and large classroom screens.

It runs entirely in the browser. Photos and recordings stay on the device: nothing is uploaded.

## Using it

1. Go to <https://evandevon.github.io/cutout-animator/>.
2. **Add a drawing.** Take a photo, choose a picture or paste one. White paper is removed automatically. Tidy up with Draw around, Erase, Add and Tap to remove.
3. **Or use the library.** Choose ready-made people, animals, buildings, vehicles and more from the Cutouts tab.
4. **Set the scene.** Choose a backdrop, background sound and music, and place your cutouts. Tap a cutout and pick an animation at the top of the stage: sway, hop, float or spin. Tap it again to stop. Press **📌 Pinned** for things that are part of the place, like trees and houses: a pinned cutout stays put while recording, and taps go through it to the cutouts behind. Library buildings, trees and rocks start pinned. Press **🔗 Stick to…** and tap another cutout to stick them together, like a hat onto a head: when the main one moves, the stuck one comes too. Park cutouts in the dark "off stage" areas at the sides so they can walk on later.
5. **Check the microphone.** The meter beside the Record button shows your volume, and the dropdown chooses a microphone if there's more than one.
6. **Record.** Your voice, the chosen sounds and every movement are recorded. Drag with a finger or the mouse. On a touch screen, several fingers can move different cutouts at once, and pinching resizes and turns a cutout.
7. **Teach a move (optional).** Tap a cutout, press Teach a move, drag it and let go. It repeats that move during recording. Grab it and it follows you, then glides back to where you grabbed it and carries on.
8. **Sound effects (optional).** In the Sounds tab, record your own sounds first. Tick the ones you want on each scene and they become big buttons under the stage: tap one while recording, or press its number key. On a touch screen, one person can tap sounds while another moves the cutouts and a third does the voice. A ready-made sound library can be switched on in the ☰ menu.
9. **Add more.** Plays the scene back so you can move another cutout or add more voice.
10. Use **＋ Blank** for a new empty scene, or **Continue story** for a new scene that starts where the selected one finishes. Hold and drag a scene to move it, and tap 🗑 on the selected scene to delete it.
11. **Make video** makes one video of the whole story, or a separate video for each scene. **Save** downloads a `.cutz` project file that can be reopened and edited from the ☰ menu.

Work also autosaves on the device and is offered back next time the page opens.

## Templates for a whole class

1. Print the [template](templates/cutout-template-A4.pdf). It's A4, so print it at A3 size if you want more room to draw. Each sheet has a backdrop box, four character boxes with movement ticks, a script area, background sound and music ticks, and a space to write down the sound effects to record.
2. Students fill them in. Dark pens and bright colours work best.
3. Scan the sheets, then in the ☰ menu choose **Add filled-in templates**. Select JPGs or PDFs with one sheet per page, or use the webcam. Sheets can be crooked or upside down, as long as all four corner squares show.
4. Check the results, tap a cutout to fix it, and press **Add scenes**. Each sheet becomes one scene. The handwritten script shows on screen during recording.

To change the sheet, edit `tools/make_templates.py` and the matching numbers at the top of `template.js`.

## On a class board

In the ☰ menu, turn on **Big buttons** and choose **Full screen**. Controls also scale up on their own on large screens.

## Project files

A `.cutz` file is a zip holding `project.json` (scenes, layouts and recorded movement) and `assets/` (cutouts, backdrops and audio). Pictures and sounds travel inside the file, so it opens on any device.

## How recording works

The app records movement data and audio, not screen video. Toolbars stay out of the picture, it works on iPads, and a recorded scene stays editable: change its backdrop, sounds or volumes, add to it, or redo it. The video is rendered from that data on export.

## Browser notes

- Use the HTTPS address above. Camera and microphone don't work from a `file://` page.
- Video is made frame by frame where the browser can encode it directly, so slow computers just take longer and the result is the same, even if you switch tabs. Older browsers, including older iPad Safari, can only record it in real time with the tab showing: it pauses and restarts if the tab is hidden, and may look jumpy on slow devices.
- Headphones give the cleanest voice recording, because the microphone can't pick up the music.

## Credits

Paper removal is adapted from Classroom Aquarium. Sound effects come from the Frame by Frame library. Background sounds and music are generated in code (`audio.js`). Uses [JSZip](https://stuk.github.io/jszip/) and [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) (MIT) and [PDF.js](https://mozilla.github.io/pdf.js/) (Apache 2.0), and the [Nunito](https://fonts.google.com/specimen/Nunito) font (OFL), included in `vendor/`.
