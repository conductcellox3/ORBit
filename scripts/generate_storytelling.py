import os
from PIL import Image, ImageDraw, ImageFont

out_dir = r"d:\Antigravity\ORBit\src-tauri\resources\default_backgrounds\03_Brainstorm"
os.makedirs(out_dir, exist_ok=True)

width, height = 1800, 1200
bg_color = (248, 249, 250, 255)
line_color = (200, 210, 224, 255)
title_color = (71, 85, 105, 255)
desc_color = (148, 163, 184, 255)

try:
    font_title = ImageFont.truetype("segoeui.ttf", 36)
    font_desc = ImageFont.truetype("segoeui.ttf", 24)
except:
    font_title = ImageFont.load_default()
    font_desc = ImageFont.load_default()

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

img = create_image()
d = ImageDraw.Draw(img)

margin = 40
inner_margin = 20

# Top row: 3 columns
top_height = 280
col3_w = (width - 2 * margin - 2 * inner_margin) // 3

top_titles = [
    ("SUBJECT", "What is the story about?"),
    ("GOAL", "What do you want to achieve\nwith this story?"),
    ("AUDIENCE", "What is your story's audience?\nWhat are their needs?")
]

for i in range(3):
    x = margin + i * (col3_w + inner_margin)
    y = margin
    draw_rounded_rect(d, [x, y, x + col3_w, y + top_height], 12, (255, 255, 255, 255), None)
    d.rectangle([x, y, x + col3_w, y + top_height], outline=line_color, width=2)
    
    d.text((x + 30, y + 30), top_titles[i][0], font=font_title, fill=title_color)
    d.text((x + 30, y + 80), top_titles[i][1], font=font_desc, fill=desc_color)

# Bottom row: 5 columns
bot_y = margin + top_height + inner_margin
bot_height = height - bot_y - margin
col5_w = (width - 2 * margin - 4 * inner_margin) // 5

bot_titles = [
    ("BEFORE", "What does your audience think,\nfeel, know, want, before they\nhave experienced your story?"),
    ("1. SET THE SCENE", "What do you need to introduce?\nWhat should be set up or \nexplained?"),
    ("2. MAKE YOUR POINT", "The audience's A-Ha moment."),
    ("3. CONCLUSION", "The end of your story. What is\nthe conclusion? What is your\ncall to action?"),
    ("AFTER", "What does your audience think,\nfeel, know, want, after they\nhave experienced your story?")
]

for i in range(5):
    x = margin + i * (col5_w + inner_margin)
    y = bot_y
    draw_rounded_rect(d, [x, y, x + col5_w, y + bot_height], 12, (255, 255, 255, 255), None)
    d.rectangle([x, y, x + col5_w, y + bot_height], outline=line_color, width=2)
    
    d.text((x + 24, y + 30), bot_titles[i][0], font=font_title, fill=title_color)
    d.text((x + 24, y + 80), bot_titles[i][1], font=font_desc, fill=desc_color)
    
img.save(os.path.join(out_dir, "06_Storytelling_Canvas.png"))
print("06_Storytelling_Canvas.png generated in", out_dir)
