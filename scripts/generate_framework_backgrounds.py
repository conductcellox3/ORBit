import os
from PIL import Image, ImageDraw, ImageFont

out_dir = r"d:\Antigravity\ORBit\src-tauri\resources\default_backgrounds\06_Task_Management"
os.makedirs(out_dir, exist_ok=True)

# Common params
width, height = 1200, 800
bg_color = (248, 249, 250, 255) # light gray/white (F8F9FA)
line_color = (226, 232, 240, 255) # E2E8F0
text_color = (100, 116, 139, 255) # 64748B

try:
    font = ImageFont.truetype("segoeui.ttf", 32)
except:
    font = ImageFont.load_default()

def create_image():
    return Image.new('RGBA', (width, height), bg_color)

def draw_rounded_rect(draw, bbox, radius, fill, outline):
    # PIL rudimentary rounded rect
    x0, y0, x1, y1 = bbox
    draw.rectangle([x0+radius, y0, x1-radius, y1], fill=fill, outline=None)
    draw.rectangle([x0, y0+radius, x1, y1-radius], fill=fill, outline=None)
    draw.pieslice([x0, y0, x0+radius*2, y0+radius*2], 180, 270, fill=fill, outline=None)
    draw.pieslice([x1-radius*2, y0, x1, y0+radius*2], 270, 360, fill=fill, outline=None)
    draw.pieslice([x0, y1-radius*2, x0+radius*2, y1], 90, 180, fill=fill, outline=None)
    draw.pieslice([x1-radius*2, y1-radius*2, x1, y1], 0, 90, fill=fill, outline=None)

# 1. Kanban Board
img1 = create_image()
d1 = ImageDraw.Draw(img1)
# 3 columns
margin = 40
col_w = (width - 4*margin) // 3
titles1 = ["To Do (Backlog)", "In Progress (Doing)", "Done (Completed)"]
for i in range(3):
    x = margin + i*(col_w + margin)
    # create white column background
    draw_rounded_rect(d1, [x, margin, x+col_w, height-margin], 16, (255, 255, 255, 200), line_color)
    # text
    try:
        tw, th = font.getbbox(titles1[i])[2:]
        d1.text((x + (col_w-tw)/2, margin + 20), titles1[i], font=font, fill=text_color)
    except:
        d1.text((x + 20, margin + 20), titles1[i], font=font, fill=text_color)
    
img1.save(os.path.join(out_dir, "01_Kanban_Board.png"))

# 2. Eisenhower Matrix
img2 = create_image()
d2 = ImageDraw.Draw(img2)
cx, cy = width//2, height//2
d2.line([(margin, cy), (width-margin, cy)], fill=line_color, width=4)
d2.line([(cx, margin), (cx, height-margin)], fill=line_color, width=4)
titles2 = [
    ("Urgent & Important (Do First)", (margin+40, margin+40)),
    ("Not Urgent & Important (Schedule)", (cx+40, margin+40)),
    ("Urgent & Not Important (Delegate)", (margin+40, cy+40)),
    ("Not Urgent & Not Important (Drop)", (cx+40, cy+40))
]
for text, pos in titles2:
    d2.text(pos, text, font=font, fill=text_color)
img2.save(os.path.join(out_dir, "02_Eisenhower_Matrix.png"))

# 3. PDCA Cycle Layout (4 quarters circular or big boxes)
img3 = create_image()
d3 = ImageDraw.Draw(img3)
# 4 columns for timeline/workflow
cw = (width - 5*margin) // 4
titles3 = ["Plan", "Do", "Check", "Action"]
for i in range(4):
    x = margin + i*(cw + margin)
    draw_rounded_rect(d3, [x, margin, x+cw, height-margin], 16, (255,255,255,200), line_color)
    try:
        tw, th = font.getbbox(titles3[i])[2:]
        d3.text((x + (cw-tw)/2, margin+20), titles3[i], font=font, fill=text_color)
    except:
        d3.text((x + 20, margin+20), titles3[i], font=font, fill=text_color)
img3.save(os.path.join(out_dir, "03_PDCA_Workflow.png"))

print("Images generated in", out_dir)
