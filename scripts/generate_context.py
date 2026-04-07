import os
from PIL import Image, ImageDraw, ImageFont

out_dir = r"d:\Antigravity\ORBit\src-tauri\resources\default_backgrounds\03_Brainstorm"
os.makedirs(out_dir, exist_ok=True)

width, height = 1800, 1200
bg_color = (250, 250, 252, 255)
block_bg = (255, 255, 255, 255)
line_color = (200, 210, 224, 255)
title_color = (51, 65, 85, 255)
desc_color = (100, 116, 139, 255)
center_color = (226, 232, 240, 255)

try:
    font_title = ImageFont.truetype("meiryo.ttc", 32)
    font_desc = ImageFont.truetype("meiryo.ttc", 22)
    font_center = ImageFont.truetype("meiryo.ttc", 48)
except:
    try:
        font_title = ImageFont.truetype("msgothic.ttc", 32)
        font_desc = ImageFont.truetype("msgothic.ttc", 22)
        font_center = ImageFont.truetype("msgothic.ttc", 48)
    except:
        font_title = ImageFont.load_default()
        font_desc = ImageFont.load_default()
        font_center = ImageFont.load_default()

def create_image():
    return Image.new('RGBA', (width, height), bg_color)

def draw_rounded_rect(draw, bbox, radius, fill, outline, outline_width=2):
    x0, y0, x1, y1 = bbox
    draw.rectangle([x0+radius, y0, x1-radius, y1], fill=fill, outline=None)
    draw.rectangle([x0, y0+radius, x1, y1-radius], fill=fill, outline=None)
    draw.pieslice([x0, y0, x0+radius*2, y0+radius*2], 180, 270, fill=fill, outline=None)
    draw.pieslice([x1-radius*2, y0, x1, y0+radius*2], 270, 360, fill=fill, outline=None)
    draw.pieslice([x0, y1-radius*2, x0+radius*2, y1], 90, 180, fill=fill, outline=None)
    draw.pieslice([x1-radius*2, y1-radius*2, x1, y1], 0, 90, fill=fill, outline=None)
    
    if outline:
        draw.arc([x0, y0, x0+radius*2, y0+radius*2], 180, 270, fill=outline, width=outline_width)
        draw.arc([x1-radius*2, y0, x1, y0+radius*2], 270, 360, fill=outline, width=outline_width)
        draw.arc([x0, y1-radius*2, x0+radius*2, y1], 90, 180, fill=outline, width=outline_width)
        draw.arc([x1-radius*2, y1-radius*2, x1, y1], 0, 90, fill=outline, width=outline_width)
        draw.line([x0+radius, y0, x1-radius, y0], fill=outline, width=outline_width)
        draw.line([x0+radius, y1, x1-radius, y1], fill=outline, width=outline_width)
        draw.line([x0, y0+radius, x0, y1-radius], fill=outline, width=outline_width)
        draw.line([x1, y0+radius, x1, y1-radius], fill=outline, width=outline_width)

def draw_text(draw, pos, text, font, fill):
    draw.text(pos, text, font=font, fill=fill)

img = create_image()
d = ImageDraw.Draw(img)

margin = 30
gap = 20

# 4 columns on top
top_y = margin
top_h = 500
col_w = (width - 2*margin - 3*gap) // 4

top_blocks = [
    {
        "title": "人口動態のトレンド",
        "desc": "人口統計、教育、雇用などに\n関するデータを探します。\nビジネスに影響を与える\n大きな変化はありますか？",
        "rect": [margin, top_y, margin+col_w, top_y+top_h]
    },
    {
        "title": "ルールと規制",
        "desc": "近い将来ビジネスに影響を\n与えるルールや規制の動向は\nありますか？",
        "rect": [margin+col_w+gap, top_y, margin+col_w*2+gap, top_y+top_h]
    },
    {
        "title": "経済と環境",
        "desc": "ビジネスに影響を与える\n経済および環境の動向は\n何ですか？",
        "rect": [margin+(col_w+gap)*2, top_y, margin+col_w*3+gap*2, top_y+top_h]
    },
    {
        "title": "競合",
        "desc": "競合他社にどのような\n傾向が見られますか？\n新規参入はありますか？",
        "rect": [margin+(col_w+gap)*3, top_y, width-margin, top_y+top_h]
    }
]

# bottom 3 blocks + center block
bot_y = top_y + top_h + gap
bot_h = height - bot_y - margin

# Center takes 2 columns of space, so we have col [tech] [center_col1] [center_col2] [uncertainty]
bot_col_w = (width - 2*margin - 3*gap) // 4
center_w = bot_col_w * 2 + gap

bot_blocks = [
    {
        "title": "技術トレンド",
        "desc": "近い将来ビジネスに影響を\n与える大きな技術的変化\nは何ですか？",
        "rect": [margin, bot_y, margin+bot_col_w, bot_y+bot_h]
    },
    {
        "title": "顧客ニーズ",
        "desc": "顧客ニーズの大きな傾向は\n何ですか？顧客の期待は\nどう変化し発展しますか？",
        "rect": [margin+bot_col_w+gap, bot_y, margin+bot_col_w*2+gap, bot_y+bot_h]
    },
    {
        "title": "不確実性",
        "desc": "予測できない大きな不確実性\nはありますか？大きな影響を\n与える可能性があるが、いつ\nどう起こるか不明確なものです。",
        "rect": [margin+(bot_col_w+gap)*3, bot_y, width-margin, bot_y+bot_h]
    }
]

center_block = {
    "title": "自社",
    "rect": [margin+(bot_col_w+gap)*2, bot_y, margin+(bot_col_w+gap)*3 - gap, bot_y+bot_h] # takes 1 column space just to balance it nicely next to customer needs
}

# Drawing Top
for b in top_blocks:
    draw_rounded_rect(d, b["rect"], 16, block_bg, line_color)
    draw_text(d, (b["rect"][0]+24, b["rect"][1]+24), b["title"], font=font_title, fill=title_color)
    draw_text(d, (b["rect"][0]+24, b["rect"][1]+80), b["desc"], font=font_desc, fill=desc_color)

# Drawing Bottom
for b in bot_blocks:
    draw_rounded_rect(d, b["rect"], 16, block_bg, line_color)
    draw_text(d, (b["rect"][0]+24, b["rect"][1]+24), b["title"], font=font_title, fill=title_color)
    draw_text(d, (b["rect"][0]+24, b["rect"][1]+80), b["desc"], font=font_desc, fill=desc_color)

# Draw Center Company Block
c_rect = center_block["rect"]
draw_rounded_rect(d, c_rect, 16, (241, 245, 249, 255), line_color, outline_width=3)
try:
    tw, th = font_center.getbbox(center_block["title"])[2:]
    d.text((c_rect[0] + (c_rect[2]-c_rect[0]-tw)/2, c_rect[1] + (c_rect[3]-c_rect[1]-th)/2 - 20), center_block["title"], font=font_center, fill=title_color)
except:
    d.text((c_rect[0]+50, c_rect[1]+100), center_block["title"], font=font_center, fill=title_color)

img.save(os.path.join(out_dir, "07_Context_Canvas.png"))
print("07_Context_Canvas.png generated in", out_dir)
