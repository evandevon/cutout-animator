# Cutout Animator

Make an animation from your own drawings. Photograph a drawing, cut it out, arrange the cutouts on a stage, then press Record and tell the story while dragging them around.

It runs entirely in the browser. Photos and recordings stay on the device: nothing is uploaded.

## Using it

1. **Add a drawing.** Take a photo, choose a picture or paste one. White paper is removed automatically. Tidy up with Draw around, Erase, Bring back and Tap to remove.
2. **Set the scene.** Choose a backdrop, background sound and music, and place your cutouts. Park cutouts in the dark area outside the frame so they can walk on later.
3. **Record.** Your voice, the chosen sounds and every movement are recorded. On a touch screen, several fingers can move different cutouts at once. Pinch to resize and turn.
4. **Add to recording.** Plays the scene back so you can move another cutout or add more voice.
5. **Make video** joins the scenes into a video. **Save project** downloads a `.cutz` file that can be reopened and edited.

Work also autosaves on the device and is offered back next time the page opens.

## Project files

A `.cutz` file is a zip holding `project.json` (scenes, layouts and recorded movement) and `assets/` (cutouts, backdrops and audio). Sounds and pictures travel inside the file, so it opens on any device.

## How recording works

The app records movement data and audio, not screen video. Toolbars stay out of the picture, it works on iPads, and a recorded scene stays editable: change its backdrop, sounds or volumes, add to it, or redo it. The video is rendered from that data on export.

## Browser notes

- It must be served over HTTPS (GitHub Pages is fine). Camera and microphone don't work from a `file://` page.
- Video comes out as MP4 where the browser can encode it directly. Otherwise the scene plays through once in real time to record it, which may give WebM on some browsers.
- Headphones give the cleanest voice recording, because the microphone can't pick up the music.

## Adding sound effects

Add audio to a folder in `sounds/` and list it in `sounds/manifest.json`.

## Credits

Paper removal is adapted from Classroom Aquarium. The effects library comes from Frame by Frame. Background sounds and music are generated in code (`audio.js`). Uses [JSZip](https://stuk.github.io/jszip/) and [mp4-muxer](https://github.com/Vanilagy/mp4-muxer) (MIT), included in `vendor/`.
