import os
from PIL import Image, ImageDraw, ImageFont

out_dir = r"d:\Antigravity\ORBit\src-tauri\resources\default_backgrounds\06_Task_Management"
os.makedirs(out_dir, exist_ok=True)

width, height = 1600, 900
bg_color = (248, 249, 250, 255)
line_color = (226, 232, 240, 255)
text_color = (100, 116, 139, 255)

try:
    font = ImageFont.truetype("segoeui.ttf", 28)
except:
    font = ImageFont.load_default()

def create_image():
    return Image.new('RGBA', (width, height), bg_color)

def draw_rounded_rect(draw, bbox, radius, fill, outline):
    x0, y0, x1, y1 = bbox
    draw.rectangle([x0+radius, y0, x1-radius, y1], fill=fill, outline=None)
    draw.rectangle([x0, y0+radius, x1, y1-radius], fill=fill, outline=None)
    draw.pieslice([x0, y0, x0+radius*2, y0+radius*2], 180, 270, fill=fill, outline=None)
    draw.pieslice([x1-radius*2, y0, x1, y0+radius*2], 270, 360, fill=fill, outline=None)
    draw.pieslice([x0, y1-radius*2, x0+radius*2, y1], 90, 180, fill=fill, outline=None)
    draw.pieslice([x1-radius*2, y1-radius*2, x1, y1], 0, 90, fill=fill, outline=None)

# GTD Canvas Layout (5 columns)
img = create_image()
d = ImageDraw.Draw(img)

margin = 32
num_cols = 5
col_w = (width - (num_cols + 1) * margin) // num_cols

titles = ["Inbox (Capture)", "Next Actions (Engage)", "Waiting For (Delegated)", "Projects (Organize)", "Someday / Maybe (Reflect)"]

for i in range(num_cols):
    x = margin + i * (col_w + margin)
    draw_rounded_rect(d, [x, margin, x+col_w, height-margin], 16, (255, 255, 255, 200), line_color)
    try:
        tw, th = font.getbbox(titles[i])[2:]
        d.text((x + (col_w-tw)/2, margin + 20), titles[i], font=font, fill=text_color)
    except:
        d.text((x + 20, margin + 20), titles[i], font=font, fill=text_color)

img.save(os.path.join(out_dir, "04_GTD_Workflow.png"))
print("04_GTD_Workflow.png generated in", out_dir)
