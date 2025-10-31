Improve the implementation instructions for the clip generation flow in the Vue component at `@client\src\components\ProjectWorkspaceDialog.vue`. Assume an `.env` file already exists with all necessary secrets. When the user clicks "Detect Clips", ensure the process follows these steps exactly:

1. Generate an audio file from the raw video file using the already bundled FFmpeg for video/audio processing.
2. Transmit this OGG audio file to the server, including the user's selected prompt.
3. On the server, forward the audio file to the Whisper AI API and retrieve the `verbose_json` response.
4. On the server, process the `verbose_json` response by removing the `words` array from each segment. For example, transform the following structure:

   **Input example:**
   ```
   {
     "task": "transcribe",
     "language": "en",
     "duration": 13.169773242630386,
     "text": "Artificial intelligence is the intelligence of machines or software, as opposed to the intelligence of humans or animals. It is also the field of study in computer science that develops and studies intelligent machines.",
     "segments": [
       {
         "id": 0,
         "text": "Artificial intelligence is the intelligence of machines or software, as opposed to the intelligence of humans or animals.",
         "start": 0.1,
         "end": 6.42,
         "language": "en",
         "speaker": "SPEAKER_00",
         "words": [
           {
             "word": "Artificial",
             "start": 0.1,
             "end": 0.561,
             "speaker": "SPEAKER_00"
           },
           {
             "word": "intelligence",
             "start": 0.601,
             "end": 1.202,
             "speaker": "SPEAKER_00"
           },
           {
             "word": "is",
             "start": 1.262,
             "end": 1.342,
             "speaker": "SPEAKER_00"
           },
           {
             "word": "the",
             "start": 1.382,
             "end": 1.462,
             "speaker": "SPEAKER_00"
           }
           // Additional words omitted for brevity...
         ]
       }
       // Additional segments omitted for brevity...
     ]
   }
   ```

   **To this output example:**
   ```
   {
     "task": "transcribe",
     "language": "en",
     "duration": 13.169773242630386,
     "text": "Artificial intelligence is the intelligence of machines or software, as opposed to the intelligence of humans or animals. It is also the field of study in computer science that develops and studies intelligent machines.",
     "segments": [
       {
         "id": 0,
         "text": "Artificial intelligence is the intelligence of machines or software, as opposed to the intelligence of humans or animals.",
         "start": 0.1,
         "end": 6.42,
         "language": "en",
         "speaker": "SPEAKER_00"
       }
       // Additional segments omitted for brevity...
     ]
   }
   ```

5. On the server, send this simplified structure to the OpenRouter API, along with the user's prompt and the system prompt defined in `@server\lib\clippster_server\ai\system_prompt.ex`.
6. On the server, validate that the response structure from the OpenRouter API matches the specifications outlined in the system prompt.
7. On the server, return the AI clip detection response and the original `verbose_json` to the client.
8. On the client, display a test dialog showing the returned data for verification purposes.