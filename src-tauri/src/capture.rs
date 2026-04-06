use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use xcap::Monitor;
use image::{RgbaImage, DynamicImage, imageops};
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct VirtualBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct StartCaptureResponse {
    pub temp_path: String,
    pub virtual_bounds: VirtualBounds,
    pub original_width: u32,
    pub original_height: u32,
}

fn get_desktop_image() -> Result<(DynamicImage, VirtualBounds), String> {
    let monitors = Monitor::all().map_err(|e| format!("Failed to get monitors: {}", e))?;
    if monitors.is_empty() {
        return Err("No monitors found".into());
    }

    let mut min_x = i32::MAX;
    let mut min_y = i32::MAX;
    let mut max_x = i32::MIN;
    let mut max_y = i32::MIN;

    for m in &monitors {
        let mx = m.x().unwrap_or(0);
        let my = m.y().unwrap_or(0);
        let mw = m.width().unwrap_or(800) as i32;
        let mh = m.height().unwrap_or(600) as i32;
        if mx < min_x { min_x = mx; }
        if my < min_y { min_y = my; }
        if mx + mw > max_x { max_x = mx + mw; }
        if my + mh > max_y { max_y = my + mh; }
    }

    let virt_width = (max_x - min_x) as u32;
    let virt_height = (max_y - min_y) as u32;

    let mut desktop_img = RgbaImage::new(virt_width, virt_height);

    for m in monitors {
        if let Ok(capture) = m.capture_image() {
            let offset_x = (m.x().unwrap_or(min_x) - min_x) as i64;
            let offset_y = (m.y().unwrap_or(min_y) - min_y) as i64;
            
            imageops::overlay(&mut desktop_img, &capture, offset_x, offset_y);
        }
    }

    let bounds = VirtualBounds {
        x: min_x,
        y: min_y,
        width: virt_width,
        height: virt_height,
    };

    Ok((DynamicImage::ImageRgba8(desktop_img), bounds))
}

#[tauri::command]
pub async fn start_capture_session(_app_handle: AppHandle) -> Result<StartCaptureResponse, String> {
    let (image, bounds) = get_desktop_image()?;
    
    // Save to temp file
    let temp_dir = std::env::temp_dir();
    let file_path = temp_dir.join("orbit_temp_screenshot.bmp");
    
    // Save as BMP for nearly instantaneous encoding instead of CPU-heavy PNG
    image.save_with_format(&file_path, image::ImageFormat::Bmp)
        .map_err(|e| format!("Failed to save temp image: {}", e))?;
        
    Ok(StartCaptureResponse {
        temp_path: file_path.to_string_lossy().into_owned(),
        virtual_bounds: bounds.clone(),
        original_width: bounds.width,
        original_height: bounds.height,
    })
}

#[derive(Serialize, Deserialize)]
pub struct SelectionRect {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Serialize, Deserialize)]
pub struct AbsoluteRect {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[tauri::command]
pub async fn finish_capture_session(rect: SelectionRect, out_path_abs: String) -> Result<String, String> {
    let temp_dir = std::env::temp_dir();
    let temp_path = temp_dir.join("orbit_temp_screenshot.bmp");
    
    if !temp_path.exists() {
        return Err("Temp screenshot not found".into());
    }

    let mut img = image::open(&temp_path).map_err(|e| format!("Failed to open temp image: {}", e))?;
    
    let cropped = img.crop(rect.x, rect.y, rect.width, rect.height);
    
    // Ensure parent dir exists
    let out_path = PathBuf::from(&out_path_abs);
    if let Some(parent) = out_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create asset directory: {}", e))?;
    }
    
    cropped.save_with_format(&out_path, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to save cropped image: {}", e))?;
    
    // Try cleanup, but don't fail if it doesn't work right away
    let _ = fs::remove_file(&temp_path);
    
    Ok(out_path_abs)
}

#[tauri::command]
pub async fn cancel_capture_session() -> Result<(), String> {
    let temp_dir = std::env::temp_dir();
    let temp_path = temp_dir.join("orbit_temp_screenshot.png");
    if temp_path.exists() {
        let _ = fs::remove_file(&temp_path);
    }
    
    // Also cleanup bmp variant
    let temp_path_bmp = temp_dir.join("orbit_temp_screenshot.bmp");
    if temp_path_bmp.exists() {
        let _ = fs::remove_file(&temp_path_bmp);
    }
    
    Ok(())
}

#[tauri::command]
pub async fn fixed_region_capture(rect: AbsoluteRect, out_path_abs: String) -> Result<(String, u32, u32), String> {
    let (mut image, bounds) = get_desktop_image()?;
    
    let buffer_x = rect.x - bounds.x;
    let buffer_y = rect.y - bounds.y;
    
    if buffer_x < 0 || buffer_y < 0 {
        return Err("BoundsExceeded: Fixed region starts outside the current desktop boundaries.".to_string());
    }
    
    let buffer_x = buffer_x as u32;
    let buffer_y = buffer_y as u32;
    
    if buffer_x + rect.width > bounds.width || buffer_y + rect.height > bounds.height {
        return Err("BoundsExceeded: Fixed region extends outside the current desktop boundaries.".to_string());
    }
    
    let cropped = image.crop(buffer_x, buffer_y, rect.width, rect.height);
    
    let out_path = PathBuf::from(&out_path_abs);
    if let Some(parent) = out_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create asset directory: {}", e))?;
    }
    
    cropped.save_with_format(&out_path, image::ImageFormat::Png)
        .map_err(|e| format!("Failed to save cropped fixed-region image: {}", e))?;
        
    Ok((out_path_abs, rect.width, rect.height))
}
