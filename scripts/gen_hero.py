import asyncio, os, base64, sys
from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage

load_dotenv("/app/backend/.env")

PROMPTS = [
    # Prompt 1 — moody cinematic streamer, back-lit, face partially obscured by RGB glow
    ("hero_streamer_a.png",
     "Ultra-cinematic vertical portrait (3:4 aspect ratio) of a Gen-Z content creator in a "
     "dark bedroom streaming setup. Shot from a slight low angle. She wears an oversized hoodie, "
     "hair tucked behind ear, mid-laugh with hand near mouth in an authentic reaction pose. "
     "Her face is softly lit by an off-screen monitor glow (warm amber on one side, electric lime-green on the other). "
     "Background: out-of-focus RGB LED strips, hanging fairy lights, a blurred keyboard with rainbow backlight, "
     "and a chunky studio mic softly out of focus in the foreground. "
     "Deep shadows, near-black background, film grain, 35mm depth of field, teal-and-orange color grade, "
     "high contrast, editorial photography, natural skin, no logos, no text. "
     "Emphasis on mood, glow and atmosphere over facial detail."),
]

async def run():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    for filename, prompt in PROMPTS:
        chat = LlmChat(api_key=api_key, session_id=f"hero-gen-{filename}", system_message="You generate cinematic marketing hero images.")
        chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])
        msg = UserMessage(text=prompt)
        text, images = await chat.send_message_multimodal_response(msg)
        print(f"Text response length: {len(text) if text else 0}")
        if not images:
            print(f"NO IMAGES for {filename}")
            continue
        out_path = f"/app/frontend/public/{filename}"
        with open(out_path, "wb") as f:
            f.write(base64.b64decode(images[0]["data"]))
        print(f"Saved {out_path} ({os.path.getsize(out_path)} bytes)")

asyncio.run(run())
