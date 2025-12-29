import sys
import whisper
import json

# Force UTF-8 output 
sys.stdout.reconfigure(encoding='utf-8')

audio_path = sys.argv[1]

model = whisper.load_model("small")
result = model.transcribe(
    audio_path,
    task="transcribe"
)


# Print ONLY text safely
print(result["text"])
